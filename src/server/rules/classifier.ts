import { Priority, MonitoringRule, EmailPayload } from '../../types.js';

const PRIORITY_ORDER: Record<Priority, number> = {
  Low: 1,
  Normal: 2,
  High: 3,
  Critical: 4,
};

const ORDER_TO_PRIORITY: Record<number, Priority> = {
  1: 'Low',
  2: 'Normal',
  3: 'High',
  4: 'Critical',
};

export interface DeadlineInfo {
  text: string;
  timestamp: number | null;
  isUncertain: boolean;
}

export interface ClassificationResult {
  priority: Priority;
  reason: string;
  deadline?: DeadlineInfo;
}

/**
 * Detect explicit or relative deadline phrases in text.
 */
export function detectDeadline(text: string, referenceDate: Date = new Date()): DeadlineInfo | null {
  if (!text) return null;

  // Patterns for deadlines
  const patterns: Array<{ regex: RegExp; parse: (match: RegExpMatchArray) => { timestamp: number | null; isUncertain: boolean } }> = [
    // Pattern: "deadline: [date]", "deadline is [date]", "due by [date]"
    {
      regex: /(?:deadline(?:\s+is|\s*:)?|due(?:\s+by|\s+on|\s*:)?)\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
      parse: (m) => {
        const clean = m[1].replace(/(st|nd|rd|th)/, '');
        const d = new Date(clean);
        return {
          timestamp: isNaN(d.getTime()) ? null : d.getTime(),
          isUncertain: isNaN(d.getTime())
        };
      }
    },
    // Pattern: "by [Month Day, Year]" (e.g., "by October 25, 2026")
    {
      regex: /\bby\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})\b/i,
      parse: (m) => {
        const clean = m[1].replace(/(st|nd|rd|th)/, '');
        const d = new Date(clean);
        return {
          timestamp: isNaN(d.getTime()) ? null : d.getTime(),
          isUncertain: isNaN(d.getTime())
        };
      }
    },
    // Pattern: "by [Month Day]" (e.g., "by Oct 25" without year -> current or next year)
    {
      regex: /\b(?:by|deadline:\s*)\s+([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?)\b/i,
      parse: (m) => {
        const clean = m[1].replace(/(st|nd|rd|th)/, '');
        const year = referenceDate.getFullYear();
        const d = new Date(`${clean} ${year}`);
        return {
          timestamp: isNaN(d.getTime()) ? null : d.getTime(),
          isUncertain: true // Ambiguous year
        };
      }
    },
    // Pattern: "within [N] hours/days"
    {
      regex: /\bwithin\s+(\d+)\s+(hour|hours|day|days)\b/i,
      parse: (m) => {
        const amount = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        const ms = unit.startsWith('hour') ? amount * 3600 * 1000 : amount * 24 * 3600 * 1000;
        return {
          timestamp: referenceDate.getTime() + ms,
          isUncertain: false
        };
      }
    },
    // Pattern: "due today" or "due tomorrow"
    {
      regex: /\bdue\s+(today|tomorrow)\b/i,
      parse: (m) => {
        const isTomorrow = m[1].toLowerCase() === 'tomorrow';
        const d = new Date(referenceDate);
        if (isTomorrow) d.setDate(d.getDate() + 1);
        d.setHours(23, 59, 59, 999);
        return {
          timestamp: d.getTime(),
          isUncertain: false
        };
      }
    },
    // Pattern: ISO or numeric dates e.g. "by 2026-10-30" or "due 10/30/2026"
    {
      regex: /\b(?:by|deadline|due)\s*[:\s]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/i,
      parse: (m) => {
        const d = new Date(m[1]);
        return {
          timestamp: isNaN(d.getTime()) ? null : d.getTime(),
          isUncertain: isNaN(d.getTime())
        };
      }
    }
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      const parsed = p.parse(match);
      return {
        text: match[0].trim(),
        timestamp: parsed.timestamp,
        isUncertain: parsed.isUncertain
      };
    }
  }

  return null;
}

/**
 * Deterministically classifies email priority and explains the reasoning.
 */
export function classifyEmail(
  matchedRules: MonitoringRule[],
  email: EmailPayload,
  timezone: string = 'UTC'
): ClassificationResult {
  // 1. Highest base threshold from matched rules
  let maxScore = 2; // Default Normal
  let highestThresholdRule: MonitoringRule | null = null;

  for (const rule of matchedRules) {
    const score = PRIORITY_ORDER[rule.priorityThreshold] || 2;
    if (score > maxScore || highestThresholdRule === null) {
      maxScore = score;
      highestThresholdRule = rule;
    }
  }

  const reasons: string[] = [];
  if (highestThresholdRule) {
    reasons.push(`Base priority set to ${highestThresholdRule.priorityThreshold} by rule '${highestThresholdRule.name}'`);
  } else {
    reasons.push('Default baseline priority Normal');
  }

  // 2. Deadline detection
  const searchContent = `${email.subject}\n${email.snippet}\n${email.bodyText}`;
  const deadline = detectDeadline(searchContent);

  if (deadline) {
    if (deadline.timestamp) {
      const now = Date.now();
      const diffHours = (deadline.timestamp - now) / (3600 * 1000);

      if (diffHours > 0 && diffHours <= 48) {
        maxScore = Math.max(maxScore, PRIORITY_ORDER.Critical);
        reasons.push(`Escalated to Critical due to imminent deadline (${deadline.text})`);
      } else if (diffHours > 48 && diffHours <= 168) { // within 7 days
        maxScore = Math.max(maxScore, PRIORITY_ORDER.High);
        reasons.push(`Escalated to High due to upcoming deadline (${deadline.text})`);
      } else {
        reasons.push(`Detected deadline (${deadline.text})`);
      }
    } else {
      reasons.push(`Detected deadline phrase: "${deadline.text}" (exact timestamp uncertain)`);
    }
  }

  // 3. Urgent phrase checks
  const urgentCriticalPhrases = [
    'immediate action required',
    'urgent action required',
    'final notice',
    'offer expires',
    'decision required',
    'payment past due',
    'account suspended'
  ];

  const lowerContent = searchContent.toLowerCase();
  for (const phrase of urgentCriticalPhrases) {
    if (lowerContent.includes(phrase)) {
      maxScore = Math.max(maxScore, PRIORITY_ORDER.Critical);
      reasons.push(`Matched critical urgency marker: "${phrase}"`);
      break;
    }
  }

  const finalPriority = ORDER_TO_PRIORITY[maxScore] || 'Normal';

  return {
    priority: finalPriority,
    reason: reasons.join('. '),
    deadline: deadline || undefined,
  };
}
