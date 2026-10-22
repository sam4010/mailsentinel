import { MonitoringRule, EmailPayload, RuleMatchResult } from '../../types.js';

/**
 * Extract normalized domain from an email address (e.g., "Admissions <housing@mail.stanford.edu>" -> "mail.stanford.edu")
 */
export function extractDomain(emailStr: string): string {
  if (!emailStr) return '';
  const match = emailStr.match(/@([a-zA-Z0-9.-]+)/);
  if (!match) return '';
  return match[1].toLowerCase().trim();
}

/**
 * Clean and normalize an email address
 */
export function normalizeEmail(emailStr: string): string {
  if (!emailStr) return '';
  const match = emailStr.match(/<([^>]+)>/);
  const raw = match ? match[1] : emailStr;
  return raw.toLowerCase().trim();
}

/**
 * Safely check if a sender domain matches a rule domain respecting domain boundaries.
 * E.g., rule domain "stanford.edu" matches "stanford.edu" and "sub.stanford.edu",
 * but does NOT match "fakestanford.edu" or "stanford.edu.phishing.com".
 */
export function matchesDomain(emailDomain: string, ruleDomain: string): boolean {
  if (!emailDomain || !ruleDomain) return false;
  const eDom = emailDomain.toLowerCase().trim();
  const rDom = ruleDomain.toLowerCase().trim().replace(/^@/, ''); // strip leading @ if present

  if (eDom === rDom) return true;
  // Subdomain match: must end with .rDom
  if (eDom.endsWith(`.${rDom}`)) return true;

  return false;
}

/**
 * Check if a text contains a keyword, using word boundary checks for single words to avoid accidental substring hits.
 */
export function containsKeyword(text: string, keyword: string, caseSensitive: boolean = false): boolean {
  if (!text || !keyword) return false;
  const kw = keyword.trim();
  if (!kw) return false;

  const flags = caseSensitive ? '' : 'i';

  // If keyword contains spaces or punctuation, match phrase directly
  if (/\s|[^\w]/.test(kw)) {
    if (caseSensitive) {
      return text.includes(kw);
    }
    return text.toLowerCase().includes(kw.toLowerCase());
  }

  // Single word: use word boundary
  try {
    const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, flags);
    return regex.test(text);
  } catch (e) {
    return caseSensitive ? text.includes(kw) : text.toLowerCase().includes(kw.toLowerCase());
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Evaluates a single rule against an email payload.
 */
export function evaluateRule(rule: MonitoringRule, email: EmailPayload): RuleMatchResult {
  const result: RuleMatchResult = {
    matched: false,
    matchedRules: [],
    reasons: [],
    matchedSenders: [],
    matchedDomains: [],
    matchedKeywords: [],
    matchedSenderNames: [],
  };

  if (!rule.enabled) {
    return result;
  }

  const senderEmail = normalizeEmail(email.senderEmail);
  const senderDomain = extractDomain(senderEmail);
  const senderName = (email.senderName || '').trim();

  // Scope for keyword search
  const textToSearch = rule.subjectOnly
    ? email.subject || ''
    : `${email.subject || ''}\n${email.snippet || ''}\n${email.bodyText || ''}`;

  // 1. Check excluded keywords first
  if (rule.excludedKeywords && rule.excludedKeywords.length > 0) {
    for (const exKw of rule.excludedKeywords) {
      if (containsKeyword(textToSearch, exKw, rule.caseSensitive)) {
        result.suppressedByExcludedKeyword = exKw;
        return result; // Suppressed immediately
      }
    }
  }

  // 2. Check Senders
  let senderMatched = false;
  if (rule.senders && rule.senders.length > 0) {
    for (const ruleSender of rule.senders) {
      const normRuleSender = normalizeEmail(ruleSender);
      if (normRuleSender && normRuleSender === senderEmail) {
        senderMatched = true;
        result.matchedSenders.push(normRuleSender);
        result.reasons.push(`Matched sender email '${normRuleSender}'`);
      }
    }
  }

  // 3. Check Domains
  let domainMatched = false;
  if (rule.domains && rule.domains.length > 0) {
    for (const ruleDomain of rule.domains) {
      if (matchesDomain(senderDomain, ruleDomain)) {
        domainMatched = true;
        result.matchedDomains.push(ruleDomain);
        result.reasons.push(`Matched sender domain '${ruleDomain}'`);
      }
    }
  }

  // 4. Check Sender Names / Organizations
  let nameMatched = false;
  if (rule.senderNames && rule.senderNames.length > 0 && senderName) {
    for (const ruleName of rule.senderNames) {
      if (containsKeyword(senderName, ruleName, false)) {
        nameMatched = true;
        result.matchedSenderNames.push(ruleName);
        result.reasons.push(`Matched sender name/org '${ruleName}'`);
      }
    }
  }

  const anySenderConditionDefined =
    (rule.senders && rule.senders.length > 0) ||
    (rule.domains && rule.domains.length > 0) ||
    (rule.senderNames && rule.senderNames.length > 0);

  const hasSenderMatch = senderMatched || domainMatched || nameMatched;

  // 5. Check Keywords
  let keywordMatched = false;
  const anyKeywordConditionDefined = rule.keywords && rule.keywords.length > 0;

  if (anyKeywordConditionDefined) {
    for (const kw of rule.keywords) {
      if (containsKeyword(textToSearch, kw, rule.caseSensitive)) {
        keywordMatched = true;
        result.matchedKeywords.push(kw);
        result.reasons.push(`Matched keyword '${kw}'${rule.subjectOnly ? ' in subject' : ''}`);
      }
    }
  }

  // 6. Evaluate Rule Semantics
  if (rule.matchAll) {
    // Both sender condition (if defined) AND keyword condition (if defined) must match
    if (anySenderConditionDefined && anyKeywordConditionDefined) {
      result.matched = hasSenderMatch && keywordMatched;
    } else if (anySenderConditionDefined) {
      result.matched = hasSenderMatch;
    } else if (anyKeywordConditionDefined) {
      result.matched = keywordMatched;
    } else {
      result.matched = false;
    }
  } else {
    // Match Any: either sender condition or keyword condition can trigger
    if (anySenderConditionDefined && anyKeywordConditionDefined) {
      result.matched = hasSenderMatch || keywordMatched;
    } else if (anySenderConditionDefined) {
      result.matched = hasSenderMatch;
    } else if (anyKeywordConditionDefined) {
      result.matched = keywordMatched;
    } else {
      result.matched = false;
    }
  }

  if (result.matched) {
    result.matchedRules.push(rule);
  }

  return result;
}

/**
 * Evaluate all active rules against an incoming email.
 * Aggregates matches and generates a clear unified explanation.
 */
export function evaluateAllRules(rules: MonitoringRule[], email: EmailPayload): {
  matched: boolean;
  matchedRules: MonitoringRule[];
  reasons: string[];
  explanation: string;
} {
  const activeRules = rules.filter(r => r.enabled);
  const matchedRules: MonitoringRule[] = [];
  const reasons: string[] = [];

  for (const rule of activeRules) {
    const res = evaluateRule(rule, email);
    if (res.matched) {
      matchedRules.push(rule);
      reasons.push(`Rule [${rule.name}]: ${res.reasons.join(', ')}`);
    }
  }

  const matched = matchedRules.length > 0;
  const explanation = matched
    ? reasons.join('; ')
    : 'No active rules matched this message.';

  return {
    matched,
    matchedRules,
    reasons,
    explanation,
  };
}
