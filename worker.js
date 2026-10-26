/**
 * SafeRelay - Telegram Private Chat Relay Bot
 * 项目地址: https://github.com/qianqi32/SafeRelay
 * 版本: 1.2.1
 * 当前版本可能仍不稳定，如遇到 BUG 请提交至 issues 或者直接联系 @KiyukieBot
*/

// 基础配置
const getEnv = (key) => {
  if (typeof globalThis[key] !== 'undefined') return globalThis[key];
  if (typeof env !== 'undefined' && env[key]) return env[key];
  return undefined;
};

const TOKEN = getEnv('ENV_BOT_TOKEN');
const WEBHOOK = '/endpoint';
const MANAGEMENT_HEADER = 'X-SafeRelay-Admin-Secret';
const SECRET = getEnv('ENV_BOT_SECRET');
const RAW_ADMIN_UID = getEnv('ENV_ADMIN_UID');
const ADMIN_IDS_ENV = getEnv('ADMIN_IDS');
const ADMIN_ID_LIST = parseAdminIdList(RAW_ADMIN_UID, ADMIN_IDS_ENV);
const ADMIN_ALLOWLIST = new Set(ADMIN_ID_LIST);
const ADMIN_UID = ADMIN_ID_LIST[0] || null;
const GROUP_ID = (() => {
  const value = getEnv('GROUP_ID');
  if (typeof value === 'undefined' || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
})();

// ========== Internationalization (i18n) ==========
// Default language is English. Users can switch per-user with /language.
// The choice is stored in KV as `lang:<userId>`. Telegram's language_code
// is intentionally NOT used to auto-switch: the bot stays in English
// until the user (or DEFAULT_LANG / BOT_LANG) says otherwise.
const SUPPORTED_LANGS = ['en', 'zh'];
const langCache = new Map();

function normalizeLang(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace('_', '-');
  if (v === 'en' || v.startsWith('en-')) return 'en';
  if (v === 'zh' || v.startsWith('zh-') || v.startsWith('zh')) return 'zh';
  return null;
}

function getDefaultLang() {
  return normalizeLang(getEnv('DEFAULT_LANG') || getEnv('BOT_LANG')) || 'en';
}

async function getUserLang(userId) {
  const fallback = getDefaultLang();
  if (userId === null || userId === undefined || userId === '') return fallback;
  const id = String(userId);
  if (langCache.has(id)) return langCache.get(id);
  try {
    if (typeof KV !== 'undefined' && KV) {
      const stored = await KV.get('lang:' + id);
      const lang = normalizeLang(stored) || fallback;
      langCache.set(id, lang);
      return lang;
    }
  } catch (e) { /* fall through to default */ }
  return fallback;
}

async function setUserLang(userId, lang) {
  const normalized = normalizeLang(lang) || getDefaultLang();
  if (userId === null || userId === undefined || userId === '') return normalized;
  const id = String(userId);
  langCache.set(id, normalized);
  try { await KV.put('lang:' + id, normalized); } catch (e) { /* cache still applies */ }
  return normalized;
}

const I18N = {
  en: {
    on: 'On', off: 'Off', set: 'Set', not_set: 'Not Set',
    guest_welcome_whitelisted: '👋 Welcome to SafeRelay!\n\nYou\'re trusted — just send your message and it goes straight to the admin.',
    guest_welcome_verified: '👋 Welcome to SafeRelay!\n\nYou\'re verified — just send your message.',
    guest_blocked: '🚫 You\'ve been blocked by the admin and can\'t send messages.',
    guest_union_banned: '🚫 <b>You\'re federation-banned.</b>\n\nYour account is banned across services for breaking the rules. Questions? Contact the admin.',
    guest_fraud_blocked: '🚫 <b>Service Unavailable</b>\n\nYour account was flagged and can\'t use this service.',
    admin_fraud_detected: '🚨 <b>Fraudulent User Detected</b>\n\n🆔 UID: <code>{uid}</code>\nThis user is in the fraud database and was blocked automatically.',
    guest_spam_blocked: '🚫 Your message broke the rules and was blocked. Questions? Contact the admin.',
    guest_spam_fake_sent: '✅ Message sent',
    admin_spam_intercepted: '🧹 <b>Spam Message Blocked</b>\n\n🆔 UID: <code>{uid}</code>\nReason: {reason}\n\n<i>The message was blocked and not forwarded to the admin.</i>',
    guest_rate_limited: '⏳ Too fast — please wait {seconds}s and try again.',
    spam_reason_links: 'Too many links ({count}/{max})',
    spam_reason_keyword: 'Blocked keyword: {keyword}',
    spam_reason_regex: 'Matched a blocked pattern',
    spam_reason_ai: 'Flagged as spam by AI',
    verification_expired_notice: '⚠️ <b>Verification Expired</b>\n\nYour topic may have been deleted or expired, so you need to verify again.\n\nPlease tap /start to restart verification.',
    kv_quota_notice: '⚠️ <b>KV Quota Exceeded</b>\n\nCloudflare KV requests are being rate-limited (429), so KV operations were paused automatically.\nPlease try again later, or check KV usage in the Cloudflare dashboard.',
    topic_recover_notice: '⚠️ The topic for guest {userId} is no longer valid. Trying to recreate it.',
    error_report: '🚨 <b>SafeRelay Error Report</b>\n\n<b>Context:</b> {context}\n<b>Error:</b> {error}\n<b>Time:</b> {time}',
    topic_env_notice: '[Notice] Topic mode is unavailable: {issue}',
    topic_issue_group_missing: 'GROUP_ID is not configured.',
    topic_issue_chat_inaccessible: 'the bot cannot access the configured group ({description}).',
    topic_issue_not_forum: 'the target group has not enabled Topics.',
    topic_issue_not_admin: 'the bot is not an administrator in the group.',
    topic_issue_missing_manage_topics: 'the bot is missing the Manage Topics permission.',
    topic_issue_membership: 'unable to read bot permissions: {description}.',
    topic_issue_default: 'unexpected error while checking the forum group.',
    err_generic: 'Operation failed',
    err_message_not_found: 'The message does not exist or has expired',
    err_empty_message: 'Message content cannot be empty',
    err_message_too_long: 'Message content is too long',
    err_chat_not_found: 'Chat not found',
    err_bot_blocked: 'You have blocked the bot. Please unblock it and try again',
    err_user_deactivated: 'The user account has been deactivated',
    err_permission_denied: 'Insufficient permissions',
    err_rate_limited: 'Too many requests. Please try again later',
    err_network_error: 'Network error. Please try again later',
    err_auth_error: 'Authentication failed. Please check the configuration',
    err_timeout: 'Request timed out. Please try again later',
    mode_local_quiz: '📝 Local Quiz',
    mode_turnstile: '☁️ Turnstile',
    mode_both: '🔒 Quiz + Turnstile',
    quiz_expired: 'Verification expired. Please request a new question.',
    quiz_max_attempts: 'Too many attempts. Please request a new question.',
    quiz_wrong: 'Wrong answer. {remaining} attempt(s) left.',
    quiz_lock_wait: '⏳ Verification is in progress. Please wait {seconds} seconds and try again.',
    quiz_invalid_data: '❌ Invalid data format',
    quiz_invalid_option: '❌ Invalid option',
    quiz_attempt_rate: '⏳ Too many attempts. Please wait {seconds} seconds and try again.',
    quiz_success_toast: 'Verification passed!',
    quiz_success_msg: '✅ Verification passed! You can now message the admin.',
    quiz_success_pending: '✅ Verification passed!\n\n📩 Your {count} queued message(s) were delivered to the admin.',
    quiz_error: '❌ Something went wrong during verification. Please try again.',
    verify_mode_switch_failed: '❌ Cannot switch to this mode. Please make sure the Turnstile keys are configured.',
    verify_mode_switched: 'Switched to: {mode}',
    verify_pending_queued: '📝 Message queued. It will be sent automatically after verification (up to {max} messages).',
    verify_too_frequent: '⏳ Too many verification attempts. Please try again in 5 minutes.',
    verify_session_failed: '⚠️ Could not create a verification session. Please try again later.',
    verify_quiz_with_welcome: '🛡️ Please answer the question below to continue:',
    verify_quiz_default: '🛡️ To prevent spam, please answer the question below:',
    verify_both_with_welcome: '🛡️ Please complete both verification steps below to continue:',
    verify_both_default: '🛡️ To prevent spam, please complete both verification steps below:',
    verify_turnstile_with_welcome: '🛡️ Please complete the verification below to continue:',
    verify_turnstile_default: '🛡️ To prevent spam, please tap the button below to complete human verification:',
    btn_verify_turnstile: '🛡️ Start Verification',
    turnstile_success: '✅ Verification passed!\n\nIf you verified more than once, please wait a minute before sending a message so the status can sync.',
    turnstile_success_pending: '✅ Verification passed!\n\n📩 Your {count} queued message(s) were delivered to the admin.',
    new_user_title: '🆕 <b>New User Joined</b>',
    new_user_name: '👤 Name: {name}',
    new_user_uid: '🆔 UID: <a href="tg://user?id={uid}">{uid}</a>',
    new_user_username: '🏷️ Username: @{username}',
    new_user_no_username: '🏷️ Username: —',
    new_user_method: '🔐 Verification: {method}',
    new_user_hint: 'Verified — they can message you now.',
    new_user_method_quiz: 'Local Quiz',
    new_user_method_turnstile: 'Turnstile',
    new_user_method_both: 'Quiz + Turnstile',
    btn_trust_user: '⭐ Trust',
    btn_ban_user: '🚫 Ban',
    toast_newuser_trusted: '⭐ Trusted user {userId}',
    toast_newuser_banned: '🚫 Banned user {userId}',
    blocked_bot_title: '🔕 <b>User Blocked the Bot</b>',
    blocked_bot_note: 'They blocked the bot — messages can no longer be delivered.',
    panel_topic_redirect: '✨ <b>Topic Mode is on — admin panels run in the group.</b>\n\nOpen the group\'s General topic to use /menu and /help, so every admin works from the same panel.',
    btn_open_group: '💬 Open Group',
    btn_open_profile: '👤 Open Profile',
    verify_not_configured: 'Turnstile is not configured',
    verify_page_title: 'Human Verification - SafeRelay',
    verify_page_heading: 'Security Verification',
    verify_page_subtitle: 'Please complete the verification below to continue',
    verify_page_success: 'Verification passed!',
    verify_page_success_desc: 'Please return to Telegram to continue chatting',
    verify_page_error: 'Verification failed',
    verify_page_error_desc: 'Please try again or refresh the page',
    verify_page_retry: 'Try Again',
    verify_page_footer: 'Powered by SafeRelay',
    verify_page_loading: 'Verifying...',
    spam_topic_name: '🗑️ Spam Bin',
    spam_silently_handled: '🗑️ <b>Spam Message Handled Silently</b>\n\n🆔 UID: <code>{uid}</code>\nTopic ID: <code>{topicId}</code>\n\n<i>The message was moved to the spam topic. The user was not notified.</i>',
    topic_welcome_hint: 'Reply in this topic to respond to the guest.',
    guest_default_name: 'Guest',
    rules_link_limit: '<b>Link Limit:</b> Up to {max} links',
    rules_block_keywords: '<b>Blocked Keywords ({count}):</b>',
    rules_block_regex: '<b>Blocked Patterns ({count}):</b>',
    rules_allow_keywords: '<b>Allowed Keywords:</b> {keywords}',
    rules_more: '... and {count} more in total',
    keyword_empty: '<i>(empty)</i>',
    keyword_more: '... and {count} more',
    forward_failed: '❌ Failed to forward the message: {error}',
    forward_failed_topic_hint: 'Please check that the bot is a group admin and that Topics are enabled.',
    forward_all_admins_blocked: '⚠️ Failed to send: all admins have blocked the bot, so no one can receive messages.',
    edit_expired: '⚠️ Could not edit the message: it has expired or was deleted (over 48 hours).\n\nPlease send a new message instead.',
    edit_failed: '⚠️ Failed to edit the message: {error}\n\nPlease send a new message instead.',
    edit_process_failed: '❌ Failed to process the edited message: {error}',
    edit_no_mapping: '⚠️ No message mapping found, so the edit cannot be synced to the guest.\n\nPossible reasons: the message expired (over 48 hours) or the bot was restarted.',
    edit_no_text: '(no text content)',
    language_title: '🌍 <b>Language / 语言</b>',
    language_prompt: '🌍 <b>Language</b>\n\nCurrent language: <b>{current}</b>\n\nChoose your language:',
    language_current_en: 'English',
    language_current_zh: '简体中文',
    language_changed: '✅ Language switched to English.',
    btn_language: '🌍 Language',
    btn_english: 'English',
    btn_chinese: '简体中文',
    menu_title: '✨ <b>SafeRelay Admin Panel</b>',
    menu_current_config: '<b>Current Settings</b>',
    menu_verify_mode: 'Verification: {mode}',
    menu_spam_filter: 'Spam Filter: {status}',
    menu_ai_detection: 'AI Detection: {status}',
    menu_union_ban: 'Federation Ban: {status}',
    menu_welcome_msg: 'Welcome: {status}',
    menu_auto_reply: 'Auto-Reply: {status}',
    menu_forward_mode: 'Forwarding: {mode}',
    menu_forward_topic: '💬 Forum Topics',
    menu_forward_direct: '📥 Direct Messages',
    menu_tap_below: 'Tap any button below to manage settings.',
    btn_verify_mode: '🔐 Verification',
    btn_spam_filter: '🧹 Spam Filter',
    btn_ai_detection: '🪄 AI Detection',
    btn_spam_topic: '🗑️ Spam Topic',
    btn_union_ban: '🌐 Federation Ban',
    btn_users: '👥 Users',
    btn_welcome: '👋 Welcome Message',
    btn_autoreply: '✉️ Auto-Reply',
    btn_forward_mode: '💬 Forwarding',
    btn_stats: '📊 Statistics',
    btn_back_main: '◀️ Back to Main Menu',
    btn_refresh: '🔄 Refresh',
    spam_title: '🧹 <b>Spam Filter Settings</b>',
    spam_status: 'Status: <b>{status}</b>',
    spam_current_rules: '<b>Current Rules:</b>',
    spam_quick_actions: '<b>Quick Actions:</b>\n• Send a keyword to add a block rule\n• Send <code>clear defaults</code> or <code>清空默认</code> to clear all default rules\n• Send <code>max_links:N</code> to set the link limit\n• Send <code>allow:keyword</code> to add an allow rule',
    spam_multiline_note: '💡 You can send multiple lines at once, one rule per line.',
    status_on_icon: '🟢 On', status_off_icon: '🔴 Off',
    btn_spam_on: '🟢 Turn On Filter', btn_spam_off: '🔴 Turn Off Filter',
    btn_manage_keywords: '🔑 Manage Keywords',
    btn_reset_rules: '🔄 Reset to Defaults',
    btn_back_spam: '◀️ Back to Spam Filter',
    toast_keywords_cleared: '✅ All blocked keywords and patterns cleared',
    toast_spam_on: 'Spam filter turned on', toast_spam_off: 'Spam filter turned off',
    toast_rules_reset: 'Reset to default rules',
    kw_title: '🔑 <b>Keyword Rules</b>',
    kw_block_keywords: '<b>Blocked Keywords ({count}):</b>',
    kw_allow_keywords: '<b>Allowed Keywords ({count}):</b>',
    kw_block_regex: '<b>Blocked Patterns ({count}):</b>',
    kw_allow_regex: '<b>Allowed Patterns ({count}):</b>',
    kw_howto: '<b>How to Manage:</b>\n• Add a blocked keyword: send the keyword directly\n• Add an allowed keyword: <code>allow:keyword</code>\n• Add a pattern: <code>regex:pattern</code>\n• Delete a blocked keyword: <code>del:keyword</code>\n• Delete an allowed keyword: <code>delallow:keyword</code>\n• Clear all: <code>clear defaults</code> or <code>清空默认</code>',
    kw_note: '💡 Keywords and patterns take effect immediately.',
    btn_view_all_keywords: '📋 View Full List',
    btn_clear_keywords: '🗑️ Clear Blocked Keywords',
    kw_list_title: '<b>Full Rule List:</b>',
    kw_section_block: '=== Blocked Keywords ===',
    kw_section_allow: '=== Allowed Keywords ===',
    kw_section_block_re: '=== Blocked Patterns ===',
    kw_section_allow_re: '=== Allowed Patterns ===',
    ai_title: '🪄 <b>AI Spam Detection</b>',
    ai_status: 'Status: <b>{status}</b>',
    ai_config_title: '<b>Configuration:</b>',
    ai_threshold: 'Confidence Threshold: {value}',
    ai_hourly_limit: 'Hourly Limit: {limit} checks',
    ai_remaining: 'Remaining This Hour: {remaining}',
    ai_reset_in: 'Resets In: {seconds}s',
    ai_howto: '<b>How It Works:</b>\n• AI detection complements keyword filtering\n• It flags ads, promotions, investment scams, and similar spam\n• Requires Cloudflare Workers AI',
    ai_env_title: '<b>Environment Variables:</b>',
    ai_tip: '💡 Tip: Use keyword filtering first, and keep AI as a fallback.',
    btn_ai_on: '🟢 Turn On AI Detection', btn_ai_off: '🔴 Turn Off AI Detection',
    btn_ai_confidence: '⚙️ Adjust Threshold', btn_ai_stats: '📊 Usage Stats',
    toast_ai_on: 'AI detection turned on', toast_ai_off: 'AI detection turned off',
    ai_stats_alert: '📊 AI Usage Stats\nUsed this hour: {used}/{limit}\nRemaining: {remaining}\nResets in: {reset}s',
    ai_confidence_prompt: '⚙️ <b>Adjust AI Threshold</b>\n\nCurrent threshold: <code>{value}</code>\n\nSend a new value (0.5–0.95):\n• Higher = stricter (fewer false positives)\n• Lower = looser (fewer misses)\n• Recommended: 0.6–0.8\n\nSend <code>/cancel</code> to cancel.',
    btn_back_ai: '◀️ Back to AI Menu',
    toast_ai_confidence_ask: 'Please enter a new threshold',
    ai_confidence_cancelled: '❌ AI threshold change cancelled',
    ai_confidence_invalid: '⚠️ Please enter a valid number (0.5–0.95), e.g. 0.75',
    ai_confidence_updated: '✅ AI threshold updated to <code>{value}</code>\n\n• Higher = stricter (fewer false positives)\n• Lower = looser (fewer misses)',
    st_title: '🗑️ <b>Spam Topic Settings</b>',
    st_status: 'Status: <b>{status}</b>',
    st_config_title: '<b>Configuration:</b>',
    st_topic_id: 'Spam Topic ID: {id}',
    st_not_set: '(not set)',
    st_auto_create: 'Auto-Create: {icon}',
    st_notify_admin: 'Admin Notifications: {icon}',
    st_related_title: '<b>Related Features:</b>',
    st_related_spam: 'Spam Filter: {icon}',
    st_related_ai: 'AI Detection: {icon}',
    st_howto: '<b>How It Works:</b>\n• The spam topic isolates spam messages\n• Messages can be forwarded silently (the guest is not notified)\n• Admins can review and restore messages at any time',
    st_steps: '<b>Setup:</b>\n1. Configure a forum group ID\n2. Tap "Auto-Create Topic" or set a topic ID manually\n3. Turn on the spam topic feature\n4. Use it together with the spam filter and AI detection',
    btn_st_on: '🟢 Turn On Spam Topic', btn_st_off: '🔴 Turn Off Spam Topic',
    btn_st_create: '➕ Auto-Create Topic', btn_st_config_id: '⚙️ Set Topic ID',
    btn_st_view: '📊 View Spam Messages', btn_back_spamtopic: '◀️ Back to Spam Topic',
    toast_st_on: 'Spam topic turned on', toast_st_off: 'Spam topic turned off',
    toast_no_group: '❌ No group ID configured',
    st_exists_title: '⚠️ <b>A Spam Topic Already Exists</b>',
    st_exists_body: 'Current Topic ID: <code>{id}</code>\n\n<b>Options:</b>\n• If the topic was deleted, tap "Force Recreate"\n• To use a new topic, delete the old one or set a new ID manually\n• If the topic is fine, keep using the existing one',
    btn_force_recreate: '🔄 Force Recreate', btn_cancel: '❌ Cancel',
    toast_st_exists: 'A spam topic already exists',
    toast_st_created: '✅ Topic created. ID: {id}',
    toast_st_recreated: '✅ Topic recreated. ID: {id}',
    toast_st_create_failed: '❌ Failed to create the topic. Please check that the bot is a group admin.',
    toast_st_create_failed_detail: '❌ Failed to create the topic. The name may already exist, or the bot lacks permission.',
    toast_back_spamtopic: 'Back to the spam topic menu',
    st_config_prompt: '⚙️ <b>Set Spam Topic ID</b>\n\nCurrent Topic ID: <code>{id}</code>\n\n<b>How to Set It:</b>\n1. Create a topic in the group manually\n2. Copy its topic ID (forward a message from the topic to find it)\n3. Send the topic ID here to finish\n\n<b>Or:</b>\n• Send "auto create" or "自动创建" to let the bot create one\n• Send "cancel" or "取消" to give up',
    toast_st_config_ask: 'Please send a topic ID or "auto create"',
    st_view_title: '📊 <b>View Spam Messages</b>',
    st_view_topic_id: '<b>Spam Topic ID:</b> <code>{id}</code>',
    st_view_link: '<b>Topic Link:</b> ',
    st_view_open_link: 'Open Topic',
    st_view_stats_title: '<b>Statistics:</b>',
    st_view_enabled: 'Spam Topic: {status}',
    st_view_notify: 'Admin Notifications: {icon}',
    st_view_desc: '<b>Notes:</b>\n• Messages flagged as spam are forwarded to the spam topic automatically\n• You can review them there and restore false positives\n• To restore a message, reply to it and send /restore',
    st_view_actions: '<b>Shortcuts:</b>\n• Tap the topic link to jump to the topic in Telegram\n• Go back to view this again',
    btn_open_topic: '🔗 Open Topic',
    toast_st_view_shown: 'Spam topic info shown',
    toast_st_no_topic: '❌ No spam topic configured. Please create one or set a topic ID first.',
    st_config_cancelled: '❌ Spam topic ID setup cancelled',
    st_auto_created: '✅ Spam topic created automatically. ID: <code>{id}</code>\n\nPlease turn on the spam topic feature in the menu.',
    st_auto_create_failed: '❌ Auto-create failed. Please check that the bot is a group admin.',
    st_invalid_id: '❌ Invalid topic ID. Please enter numbers only, or a topic link.',
    st_id_set: '✅ Spam topic ID set: <code>{id}</code>\n\nPlease turn on the spam topic feature in the menu.',
    fwd_title: '💬 <b>Forwarding Mode</b>',
    fwd_current: 'Current Mode: <b>{mode}</b>',
    fwd_mode_topic_label: 'Topic Mode (Forum Group)',
    fwd_mode_direct_label: 'Direct Mode (Admin Chat)',
    fwd_desc: '<b>How It Works:</b>\n• Direct Mode: all messages go to the admin chat only\n• Topic Mode: a topic is created for each guest, and messages go to the forum group',
    fwd_prereq_title: '<b>Before enabling Topic Mode, please complete:</b>',
    fwd_issue_group: '• GROUP_ID environment variable is not set',
    fwd_issue_admin: '• ENV_ADMIN_UID (primary admin) is not set',
    fwd_ready: '✅ Topic Mode requirements are met. You can enable it at any time.',
    fwd_note: 'In Topic Mode, make sure the bot is a group admin with the Manage Topics permission.',
    btn_fwd_direct: '📥 Direct Messages', btn_fwd_topic: '💬 Forum Topics',
    toast_fwd_need_config: '⚠️ Please configure GROUP_ID and ENV_ADMIN_UID in the environment variables first',
    toast_fwd_topic_unavailable: 'Topic mode unavailable: {issue}',
    toast_fwd_switched_topic: 'Switched to Topic Mode', toast_fwd_switched_direct: 'Switched to Direct Mode',
    verify_title: '🔐 <b>Verification Settings</b>',
    verify_current: 'Current Mode: <b>{mode}</b>',
    verify_options_title: '<b>Available Modes:</b>',
    verify_options_block: '📝 <b>Local Quiz</b> - Simple built-in questions (default, no setup needed)\n☁️ <b>Turnstile</b> - Cloudflare Turnstile web verification\n🔒 <b>Quiz + Turnstile</b> - Both checks are required',
    verify_turnstile_missing: '⚠️ <b>Note:</b> No Turnstile configuration was detected, so only Local Quiz is available.\nSet CF_TURNSTILE_SITE_KEY and CF_TURNSTILE_SECRET_KEY in the environment variables to use other modes.',
    union_title: '🌐 <b>Federation Ban Settings</b>',
    union_status: 'Status: {status}',
    union_desc: 'Federation Ban automatically blocks users flagged as malicious by other services.',
    union_tap: 'Tap the button below to toggle it.',
    btn_union_on: '🟢 Turn On Federation Ban', btn_union_off: '🔴 Turn Off Federation Ban',
    toast_union_on: 'Federation Ban turned on', toast_union_off: 'Federation Ban turned off',
    welcome_title: '👋 <b>Welcome Message Settings</b>',
    welcome_current: '📄 <b>Current Content:</b>',
    welcome_not_set: '(not set; the default message is used)',
    welcome_howto: '💡 <b>How to Use:</b>\n• Send <code>/welcome Your message</code> to set a new message\n• Send <code>/welcome delete</code> to delete it and use the default\n\nGuests see this message when they first contact the bot.',
    autoreply_title: '✉️ <b>Auto-Reply Settings</b>',
    autoreply_current: '📄 <b>Current Content:</b>',
    autoreply_not_set: '(off)',
    autoreply_howto: '💡 <b>How to Use:</b>\n• Send <code>/autoreply Your message</code> to set an auto-reply\n• Send <code>/autoreply off</code> to turn it off\n\nVerified guests receive this reply when they send a message.',
    stats_title: '📊 <b>Statistics</b>',
    stats_today: '📅 <b>Today ({date})</b>',
    stats_today_messages: 'Messages: {count}',
    stats_today_active: 'Active Users: {count}',
    stats_total_title: '📈 <b>All Time</b>',
    stats_total_messages: 'Total Messages: {count}',
    stats_note: '💡 Data is updated hourly.',
    users_title: '👥 <b>User Management</b>',
    filter_all: 'All Users', filter_whitelisted: 'Trusted Users', filter_blocked: 'Blocked Users',
    filter_all_short: 'All', filter_whitelisted_short: 'Trusted', filter_blocked_short: 'Blocked',
    users_summary: '📊 Total {total} | Trusted {whitelisted} | Blocked {blocked}',
    users_empty: 'No matching users.',
    users_page_info: 'Page {page}/{totalPages}',
    users_hint: '💡 Tap a number button below to manage that user.',
    users_trusted_tag: 'Trusted', users_blocked_tag: 'Blocked',
    btn_prev_page: '◀️ Prev', btn_next_page: 'Next ▶️',
    user_uid_line: '🆔 UID: <code>{uid}</code>',
    user_status_line: 'Status: {icon} {status}',
    user_status_trusted: 'Trusted', user_status_blocked: 'Blocked', user_status_normal: 'Regular User',
    user_choose_action: 'Choose an action:',
    btn_trust: '⭐ Trust', btn_untrust: '❌ Remove Trust',
    btn_block: '🚫 Block', btn_unblock: '✅ Unblock',
    btn_back_users: '◀️ Back to User List',
    toast_page: 'Page {page}',
    toast_filter_switched: 'Switched: {filter}',
    toast_refreshed: 'Refreshed',
    toast_user_trusted: 'Trusted user {userId}', toast_user_untrusted: 'Removed trust for user {userId}',
    toast_user_blocked: 'Blocked user {userId}', toast_user_unblocked: 'Unblocked user {userId}',
    help_title: '✨ <b>SafeRelay Admin Panel</b>',
    help_common_title: '<b>Common:</b>',
    help_user_mgmt_title: '<b>Users (reply to a message, or add an ID):</b>',
    help_msg_settings_title: '<b>Messages:</b>',
    help_forward_system_title: '<b>System:</b>',
    help_forward_switch_note: 'Forwarding mode: switch in /menu → 💬 Forwarding',
    help_shortcut_note: '<b>Shortcut:</b> Reply to any guest message to answer them',
    help_footer: '<i>Verification: {verifyMode} | Filter: {filterStatus}</i>',
    help_body: '<b>Common:</b>\n/menu - Admin panel\n/help - This help\n/language - Language\n/broadcast - Broadcast to all guests\n/bcancel - Cancel broadcast\n\n<b>Users (reply to a message, or add an ID):</b>\n/ban - Block\n/unban - Unblock\n/reset - Reset verification\n/trust - Trust (skip checks)\n/untrust - Remove trust\n\n<b>Messages:</b>\n/welcome - Welcome message\n/autoreply - Auto-reply\n\n<b>System:</b>\n/cleanup - Clean up stale topics\n/cachestats - Cache stats\n/clearcache - Clear caches\nForwarding mode: switch in /menu → 💬 Forwarding\n\n<b>Shortcut:</b> Reply to any guest message to answer them',
    welcome_deleted: '✅ Welcome message deleted (back to default).',
    welcome_set: '✅ Welcome message set.',
    autoreply_off_done: '✅ Auto-reply turned off.',
    autoreply_set: '✅ Auto-reply set.',
    kw_allow_added: '✅ Allowed keyword added: <code>{keyword}</code>',
    kw_already_exists: '⚠️ This allowed keyword already exists.',
    kw_regex_added: '✅ Pattern added: <code>{regex}</code>',
    kw_regex_invalid: '❌ Invalid regular expression.',
    kw_block_deleted: '✅ Blocked keyword deleted: <code>{keyword}</code>',
    kw_block_not_found: '⚠️ Blocked keyword not found.',
    kw_allow_deleted: '✅ Allowed keyword deleted: <code>{keyword}</code>',
    kw_allow_not_found: '⚠️ Allowed keyword not found.',
    kw_rules_reset_done: '✅ Reset to default rules.',
    max_links_set: '✅ Link limit set to: {count}',
    invalid_number: '⚠️ Please enter a valid number.',
    kw_added: '✅ Blocked keyword added: <code>{keyword}</code>\nSend del:{keyword} to delete it',
    kw_manage_general_only: 'ℹ️ Keyword management is only available in the General topic or in a private chat.\n\nYou are in a guest topic, so your message will be forwarded to that guest.',
    ban_success: '🚫 User <code>{id}</code> has been blocked.',
    ban_usage: '⚠️ Invalid format.\nReply to a user message and send /ban\nor send /ban 123456 (numeric ID only)',
    unban_success: '✅ User <code>{id}</code> has been unblocked.',
    unban_usage: '⚠️ Invalid format.\nReply to a user message and send /unban\nor send /unban 123456 (numeric ID only)',
    reset_whitelist_warning: '⚠️ User <code>{id}</code> is on the trusted list and can message without verification.\n\nTo restrict this user, remove them from the trusted list first.',
    reset_success: '🔄 Verification reset for user <code>{id}</code>.',
    reset_usage: '⚠️ Invalid format.\nReply to a user message and send /reset\nor send /reset 123456 (numeric ID only)',
    broadcast_usage: '⚠️ Invalid format.\nUsage: /broadcast Your message\n\nHTML is supported:\n<b>Bold</b> <i>Italic</i> <code>Code</code>',
    broadcast_cooldown: '⏳ Broadcast is on cooldown. Please try again in {hours} hour(s).',
    broadcast_cooldown_limit: '⏳ Broadcast is on cooldown. Please try again in {hours} hour(s).\n\nLimit: {limit} per 24 hours',
    broadcast_title_done: 'Broadcast Complete', broadcast_title_partial: 'Broadcast Partially Complete (Timed Out)',
    broadcast_sent_line: '✅ Sent: {sent}/{total}',
    broadcast_failed_line: '❌ Failed: {failed}',
    broadcast_skipped_line: '⏭️ Skipped (blocked): {skipped}',
    btn_bc_continue: '▶️ Continue Sending', btn_bc_cancel: '❌ Cancel Broadcast',
    toast_bc_sending: 'Sending...', toast_bc_expired: 'Broadcast expired',
    broadcast_expired_text: '❌ The broadcast message has expired or was cancelled',
    broadcast_cancelled_text: '✅ Broadcast cancelled',
    toast_cancelled: 'Cancelled',
    trust_success: '✅ User <code>{id}</code> is now trusted.',
    trust_hint: '📋 Reply to a user message, or send /trust 123456 to trust a user',
    untrust_success: '✅ Trust removed for user <code>{id}</code>.',
    untrust_hint: '📋 Reply to a user message, or send /untrust 123456 to remove trust',
    bcancel_done: '✅ Broadcast cancelled',
    cache_stats_text: '⚡ <b>Cache Statistics</b>\n\n<b>L1 In-Memory Cache:</b>\n  Hits: {l1Hits}\n  Misses: {l1Misses}\n  Hit Rate: {l1Rate}\n  Entries: {l1Size}\n\n<b>L2 KV Cache:</b>\n  Hits: {l2Hits}\n  Misses: {l2Misses}\n  Hit Rate: {l2Rate}\n\n<i>Tip: a higher hit rate means better performance.</i>',
    clearcache_done: '✅ All caches cleared\n\nThe L1 in-memory cache and statistics were reset.\nThe L2 KV cache will expire automatically.',
    restore_not_enabled: '⚠️ The spam topic feature is not enabled, so messages cannot be restored.',
    restore_wrong_topic: '⚠️ Please reply to a message in the spam topic to restore it.\n\nNote: only messages in the spam topic can be restored.',
    restore_success_topic: '✅ Message restored to the guest topic\n\n🆔 UID: <code>{uid}</code>\nTopic ID: <code>{topicId}</code>',
    restore_success_dm: '✅ Message restored and sent to the guest\n\n🆔 UID: <code>{uid}</code>',
    restore_no_mapping: '⚠️ No message mapping found, so it cannot be restored.\n\nPossible reasons: the mapping expired (over 48 hours), or the message was not forwarded via the spam topic feature.',
    restore_failed: '❌ Failed to restore the message. Please try again later.',
    invalid_command_topic: '⚠️ Invalid command "{cmd}"\n\nSend /help to see all available commands.',
    invalid_command: '⚠️ Invalid command "{cmd}"\n\nPlease check the spelling, or send /help to see all available commands.',
    no_mapping_old: '⚠️ No original guest mapping found. The message may be too old, or the cache was cleared.',
    help_hint: '🤖 Send /help to see all commands, or reply to a guest message to answer them.',
    spam_rules_updated: '✅ Spam filter rules updated',
    cleanup_no_group: '⚠️ GROUP_ID is not configured\n\nTopic cleanup is only needed when using a forum group.\nPlease set GROUP_ID in the Cloudflare environment variables.',
    cleanup_scan_dry: '🔍 <b>Scanning for Invalid Topics (Preview Mode)</b>',
    cleanup_scan: '🧽 <b>Cleaning Up Invalid Topics</b>',
    cleanup_scanning: 'Scanning user data...',
    cleanup_progress: 'Progress: {done}/{total}\nInvalid found: {invalid}',
    cleanup_progress_cleaned: 'Cleaned: {cleaned}',
    cleanup_done_title: '✅ <b>Cleanup Complete</b>',
    cleanup_stats_title: '📊 <b>Statistics:</b>',
    cleanup_total_users: 'Total Users: {count}',
    cleanup_invalid_topics: 'Invalid Topics: {count}',
    cleanup_cleaned: 'Cleaned: {count}',
    cleanup_preview_note: 'Preview Mode: nothing was deleted',
    cleanup_errors: 'Errors: {count}',
    cleanup_invalid_list_title: '<b>Invalid Users:</b>',
    cleanup_more: '... and {count} more',
    cleanup_failed: '❌ <b>Cleanup Failed</b>\n\nError: {error}\n\nPlease check the logs or try again.'
  },
  zh: {
    on: '已开启', off: '已关闭', set: '已设置', not_set: '未设置',
    guest_welcome_whitelisted: '👋 欢迎使用 SafeRelay！\n\n您在信任名单中，直接发消息即可送达管理员。',
    guest_welcome_verified: '👋 欢迎使用 SafeRelay！\n\n您已通过验证，直接发消息即可。',
    guest_blocked: '🚫 您已被管理员拉黑，无法发送消息。',
    guest_union_banned: '🚫 <b>您已被联合封禁。</b>\n\n账号因违规被全局封禁。如有疑问，请联系管理员。',
    guest_fraud_blocked: '🚫 <b>服务不可用</b>\n\n账号存在异常，暂时无法使用本服务。',
    admin_fraud_detected: '🚨 <b>检测到欺诈用户</b>\n\n🆔 UID: <code>{uid}</code>\n该用户出现在欺诈数据库中，已自动拦截。',
    guest_spam_blocked: '🚫 消息因违规被拦截。如有疑问，请联系管理员。',
    guest_spam_fake_sent: '✅ 消息已发送',
    admin_spam_intercepted: '🧹 <b>垃圾消息拦截</b>\n\n🆔 UID: <code>{uid}</code>\n原因：{reason}\n\n<i>消息已拦截，未转发给管理员。</i>',
    guest_rate_limited: '⏳ 发送过于频繁，请等待 {seconds} 秒后再试。',
    spam_reason_links: '链接过多 ({count}/{max})',
    spam_reason_keyword: '命中关键词：{keyword}',
    spam_reason_regex: '命中正则规则',
    spam_reason_ai: 'AI 识别为垃圾消息',
    verification_expired_notice: '⚠️ <b>验证失效通知</b>\n\n您的话题可能已被删除或失效，需要重新验证。\n\n请点击 /start 重新开始验证流程。',
    kv_quota_notice: '⚠️ <b>KV 配额超限</b>\n\nCloudflare KV 操作被限制（429），已自动暂停 KV 操作。\n请稍后重试，或检查 Cloudflare 后台的 KV 用量。',
    topic_recover_notice: '⚠️ 访客 {userId} 的话题已失效，正在尝试重新创建。',
    error_report: '🚨 <b>SafeRelay 错误报告</b>\n\n<b>上下文：</b> {context}\n<b>错误：</b> {error}\n<b>时间：</b> {time}',
    topic_env_notice: '[通知] 话题模式不可用：{issue}',
    topic_issue_group_missing: '未配置 GROUP_ID。',
    topic_issue_chat_inaccessible: '机器人无法访问已配置的群组（{description}）。',
    topic_issue_not_forum: '目标群组尚未开启话题功能。',
    topic_issue_not_admin: '机器人不是群组管理员。',
    topic_issue_missing_manage_topics: '机器人缺少「管理话题」权限。',
    topic_issue_membership: '无法读取机器人权限：{description}。',
    topic_issue_default: '检查论坛群组时出现意外错误。',
    err_generic: '操作失败',
    err_message_not_found: '消息不存在或已过期',
    err_empty_message: '消息内容不能为空',
    err_message_too_long: '消息内容过长',
    err_chat_not_found: '聊天不存在',
    err_bot_blocked: '您已屏蔽机器人，请解除屏蔽后重试',
    err_user_deactivated: '用户账号已注销',
    err_permission_denied: '权限不足',
    err_rate_limited: '操作过于频繁，请稍后再试',
    err_network_error: '网络错误，请稍后重试',
    err_auth_error: '认证失败，请检查配置',
    err_timeout: '请求超时，请稍后重试',
    mode_local_quiz: '📝 本地题库',
    mode_turnstile: '☁️ Turnstile',
    mode_both: '🔒 双重验证',
    quiz_expired: '验证已过期，请重新获取题目',
    quiz_max_attempts: '尝试次数过多，请重新获取题目',
    quiz_wrong: '答案错误，还剩 {remaining} 次机会',
    quiz_lock_wait: '⏳ 验证进行中，请等待 {seconds} 秒后再试',
    quiz_invalid_data: '❌ 无效的数据格式',
    quiz_invalid_option: '❌ 无效的选项',
    quiz_attempt_rate: '⏳ 尝试过于频繁，请等待 {seconds} 秒后再试',
    quiz_success_toast: '验证成功！',
    quiz_success_msg: '✅ 验证成功！您现在可以发送消息给管理员了。',
    quiz_success_pending: '✅ 验证成功！\n\n📩 刚才的 {count} 条消息已送达管理员。',
    quiz_error: '❌ 验证处理出错，请重试',
    verify_mode_switch_failed: '❌ 无法切换到该模式，请确保已配置 Turnstile 密钥',
    verify_mode_switched: '已切换到：{mode}',
    verify_pending_queued: '📝 消息已暂存，完成验证后会自动发送（最多暂存 {max} 条）',
    verify_too_frequent: '⏳ 验证尝试过于频繁，请 5 分钟后再试。',
    verify_session_failed: '⚠️ 系统暂时无法创建验证会话，请稍后再试。',
    verify_quiz_with_welcome: '🛡️ 请回答以下问题以继续对话：',
    verify_quiz_default: '🛡️ 为了防止垃圾消息，请回答以下问题：',
    verify_both_with_welcome: '🛡️ 请完成以下两步验证以继续对话：',
    verify_both_default: '🛡️ 为了防止垃圾消息，请完成以下两步验证：',
    verify_turnstile_with_welcome: '🛡️ 请完成下方验证以继续对话：',
    verify_turnstile_default: '🛡️ 为了防止垃圾消息，请点击下方按钮完成人机验证：',
    btn_verify_turnstile: '🛡️ 开始人机验证',
    turnstile_success: '✅ 验证通过！\n\n如果重复验证请等待一分钟后再发送消息，以确保验证状态同步。',
    turnstile_success_pending: '✅ 验证通过！\n\n📩 刚才的 {count} 条消息已送达管理员。',
    new_user_title: '🆕 <b>新用户接入</b>',
    new_user_name: '👤 昵称：{name}',
    new_user_uid: '🆔 UID：<a href="tg://user?id={uid}">{uid}</a>',
    new_user_username: '🏷️ 用户名：@{username}',
    new_user_no_username: '🏷️ 用户名：—',
    new_user_method: '🔐 验证方式：{method}',
    new_user_hint: '已通过验证，可以开始发消息。',
    new_user_method_quiz: '本地题库',
    new_user_method_turnstile: 'Turnstile',
    new_user_method_both: '题库 + Turnstile',
    btn_trust_user: '⭐ 信任',
    btn_ban_user: '🚫 封禁',
    toast_newuser_trusted: '⭐ 已信任用户 {userId}',
    toast_newuser_banned: '🚫 已封禁用户 {userId}',
    blocked_bot_title: '🔕 <b>用户已屏蔽机器人</b>',
    blocked_bot_note: '对方已屏蔽机器人，消息无法再送达。',
    panel_topic_redirect: '✨ <b>话题模式已开启，管理面板在群组里使用。</b>\n\n请到群组的 General 话题里使用 /menu 和 /help，这样所有管理员看到的是同一个面板。',
    btn_open_group: '💬 打开群组',
    btn_open_profile: '👤 打开用户资料',
    verify_not_configured: 'Turnstile 未配置',
    verify_page_title: '人机验证 - SafeRelay',
    verify_page_heading: '安全验证',
    verify_page_subtitle: '请完成下方验证以继续对话',
    verify_page_success: '验证成功！',
    verify_page_success_desc: '请返回 Telegram 继续聊天',
    verify_page_error: '验证失败',
    verify_page_error_desc: '请重试或刷新页面',
    verify_page_retry: '重新验证',
    verify_page_footer: '该界面由 SafeRelay 提供',
    verify_page_loading: '验证中...',
    spam_topic_name: '🗑️ 垃圾消息回收站',
    spam_silently_handled: '🗑️ <b>垃圾消息已静默处理</b>\n\n🆔 UID: <code>{uid}</code>\n话题 ID: <code>{topicId}</code>\n\n<i>消息已转发到垃圾话题，访客无感知。</i>',
    topic_welcome_hint: '请在此话题内回复访客消息。',
    guest_default_name: '访客',
    rules_link_limit: '<b>链接限制：</b> 最多 {max} 个',
    rules_block_keywords: '<b>拦截关键词（{count} 个）：</b>',
    rules_block_regex: '<b>拦截正则（{count} 个）：</b>',
    rules_allow_keywords: '<b>放行关键词：</b> {keywords}',
    rules_more: '... 等共 {count} 个',
    keyword_empty: '<i>(空)</i>',
    keyword_more: '... 还有 {count} 个',
    forward_failed: '❌ 转发消息失败：{error}',
    forward_failed_topic_hint: '请检查机器人是否为群组管理员，并确认群组已启用话题。',
    forward_all_admins_blocked: '⚠️ 消息发送失败：所有管理员均已屏蔽机器人，无法接收消息。',
    edit_expired: '⚠️ 无法编辑消息：消息已过期或被删除（超过 48 小时）。\n\n如需修改，请直接发送新消息。',
    edit_failed: '⚠️ 编辑消息失败：{error}\n\n如需修改，请直接发送新消息。',
    edit_process_failed: '❌ 处理编辑消息失败：{error}',
    edit_no_mapping: '⚠️ 未找到消息映射关系，无法同步编辑到访客。\n\n可能原因：消息已过期（超过 48 小时）或机器人已重启。',
    edit_no_text: '(无文本内容)',
    language_title: '🌍 <b>Language / 语言</b>',
    language_prompt: '🌍 <b>语言设置</b>\n\n当前语言：<b>{current}</b>\n\n请选择语言：',
    language_current_en: 'English',
    language_current_zh: '简体中文',
    language_changed: '✅ 已切换为简体中文。',
    btn_language: '🌍 语言',
    btn_english: 'English',
    btn_chinese: '简体中文',
    menu_title: '✨ <b>SafeRelay 管理面板</b>',
    menu_current_config: '<b>当前配置</b>',
    menu_verify_mode: '验证：{mode}',
    menu_spam_filter: '垃圾过滤：{status}',
    menu_ai_detection: 'AI 检测：{status}',
    menu_union_ban: '联合封禁：{status}',
    menu_welcome_msg: '欢迎语：{status}',
    menu_auto_reply: '自动回复：{status}',
    menu_forward_mode: '转发模式：{mode}',
    menu_forward_topic: '💬 话题',
    menu_forward_direct: '📥 私聊',
    menu_tap_below: '点下方按钮即可设置。',
    btn_verify_mode: '🔐 验证模式',
    btn_spam_filter: '🧹 垃圾过滤',
    btn_ai_detection: '🪄 AI 检测',
    btn_spam_topic: '🗑️ 垃圾话题',
    btn_union_ban: '🌐 联合封禁',
    btn_users: '👥 用户管理',
    btn_welcome: '👋 欢迎消息',
    btn_autoreply: '✉️ 自动回复',
    btn_forward_mode: '💬 转发模式',
    btn_stats: '📊 统计信息',
    btn_back_main: '◀️ 返回主菜单',
    btn_refresh: '🔄 刷新',
    spam_title: '🧹 <b>垃圾消息过滤设置</b>',
    spam_status: '当前状态：<b>{status}</b>',
    spam_current_rules: '<b>当前规则：</b>',
    spam_quick_actions: '<b>快捷操作：</b>\n• 直接发送关键词添加拦截规则\n• 发送 <code>清空默认</code> 或 <code>clear defaults</code> 清空所有默认规则\n• 发送 <code>max_links:N</code> 设置链接限制\n• 发送 <code>allow:关键词</code> 添加放行规则',
    spam_multiline_note: '💡 支持同时发送多行，每行一个规则。',
    status_on_icon: '🟢 已开启', status_off_icon: '🔴 已关闭',
    btn_spam_on: '🟢 开启过滤', btn_spam_off: '🔴 关闭过滤',
    btn_manage_keywords: '🔑 关键词管理',
    btn_reset_rules: '🔄 重置为默认规则',
    btn_back_spam: '◀️ 返回过滤设置',
    toast_keywords_cleared: '✅ 已清空所有拦截关键词和正则',
    toast_spam_on: '垃圾过滤已开启', toast_spam_off: '垃圾过滤已关闭',
    toast_rules_reset: '已重置为默认规则',
    kw_title: '🔑 <b>关键词规则管理</b>',
    kw_block_keywords: '<b>拦截关键词（{count} 个）：</b>',
    kw_allow_keywords: '<b>放行关键词（{count} 个）：</b>',
    kw_block_regex: '<b>拦截正则（{count} 个）：</b>',
    kw_allow_regex: '<b>放行正则（{count} 个）：</b>',
    kw_howto: '<b>管理方法：</b>\n• 添加拦截词：直接发送关键词\n• 添加放行词：<code>allow:关键词</code>\n• 添加正则：<code>regex:正则表达式</code>\n• 删除拦截词：<code>del:关键词</code>\n• 删除放行词：<code>delallow:关键词</code>\n• 清空所有：<code>清空默认</code> 或 <code>clear defaults</code>',
    kw_note: '💡 关键词和正则会立即生效。',
    btn_view_all_keywords: '📋 查看完整列表',
    btn_clear_keywords: '🗑️ 清空拦截词',
    kw_list_title: '<b>完整规则列表：</b>',
    kw_section_block: '=== 拦截关键词 ===',
    kw_section_allow: '=== 放行关键词 ===',
    kw_section_block_re: '=== 拦截正则 ===',
    kw_section_allow_re: '=== 放行正则 ===',
    ai_title: '🪄 <b>AI 垃圾检测设置</b>',
    ai_status: '当前状态：<b>{status}</b>',
    ai_config_title: '<b>配置信息：</b>',
    ai_threshold: '置信度阈值：{value}',
    ai_hourly_limit: '每小时限额：{limit} 次',
    ai_remaining: '剩余次数：{remaining} 次',
    ai_reset_in: '重置时间：{seconds} 秒后',
    ai_howto: '<b>使用说明：</b>\n• AI 检测作为关键词过滤的补充\n• 自动识别广告、推广、投资等垃圾内容\n• 需要配置 Cloudflare Workers AI',
    ai_env_title: '<b>环境变量：</b>',
    ai_tip: '💡 建议：先使用关键词过滤，AI 作为兜底策略。',
    btn_ai_on: '🟢 开启 AI 检测', btn_ai_off: '🔴 关闭 AI 检测',
    btn_ai_confidence: '⚙️ 调整置信度', btn_ai_stats: '📊 查看使用统计',
    toast_ai_on: 'AI 检测已开启', toast_ai_off: 'AI 检测已关闭',
    ai_stats_alert: '📊 AI 使用统计\n本小时已用：{used}/{limit}\n剩余：{remaining}\n重置：{reset} 秒后',
    ai_confidence_prompt: '⚙️ <b>调整 AI 置信度</b>\n\n当前阈值：<code>{value}</code>\n\n请发送一个新数值（0.5 ~ 0.95）：\n• 越高越严格（减少误判）\n• 越低越宽松（减少漏判）\n• 建议范围：0.6 ~ 0.8\n\n发送 <code>/cancel</code> 取消',
    btn_back_ai: '◀️ 返回 AI 菜单',
    toast_ai_confidence_ask: '请输入新的置信度阈值',
    ai_confidence_cancelled: '❌ 已取消调整置信度',
    ai_confidence_invalid: '⚠️ 请输入有效的数值（0.5 ~ 0.95），例如：0.75',
    ai_confidence_updated: '✅ AI 置信度已更新为 <code>{value}</code>\n\n• 越高越严格（减少误判）\n• 越低越宽松（减少漏判）',
    st_title: '🗑️ <b>垃圾话题管理设置</b>',
    st_status: '当前状态：<b>{status}</b>',
    st_config_title: '<b>配置信息：</b>',
    st_topic_id: '垃圾话题 ID：{id}',
    st_not_set: '(未设置)',
    st_auto_create: '自动创建：{icon}',
    st_notify_admin: '管理员通知：{icon}',
    st_related_title: '<b>关联功能：</b>',
    st_related_spam: '垃圾过滤：{icon}',
    st_related_ai: 'AI 检测：{icon}',
    st_howto: '<b>使用说明：</b>\n• 垃圾话题用于隔离垃圾消息\n• 可选择静默转发（访客无感知）\n• 管理员可随时查看和恢复消息',
    st_steps: '<b>操作步骤：</b>\n1. 配置群组 ID（论坛群组）\n2. 点击「自动创建话题」或手动指定\n3. 开启垃圾话题功能\n4. 配合垃圾过滤和 AI 检测使用',
    btn_st_on: '🟢 开启垃圾话题', btn_st_off: '🔴 关闭垃圾话题',
    btn_st_create: '➕ 自动创建话题', btn_st_config_id: '⚙️ 配置话题 ID',
    btn_st_view: '📊 查看垃圾消息', btn_back_spamtopic: '◀️ 返回垃圾话题菜单',
    toast_st_on: '垃圾话题已开启', toast_st_off: '垃圾话题已关闭',
    toast_no_group: '❌ 未配置群组 ID',
    st_exists_title: '⚠️ <b>垃圾话题已存在</b>',
    st_exists_body: '当前话题 ID：<code>{id}</code>\n\n<b>选项：</b>\n• 如果话题已被删除，请点击「强制重新创建」\n• 如果想使用新话题，请先删除旧话题或手动指定新 ID\n• 如果话题正常，请直接使用现有话题',
    btn_force_recreate: '🔄 强制重新创建', btn_cancel: '❌ 取消',
    toast_st_exists: '垃圾话题已存在',
    toast_st_created: '✅ 话题已创建，ID：{id}',
    toast_st_recreated: '✅ 话题已重新创建，ID：{id}',
    toast_st_create_failed: '❌ 创建话题失败，请检查机器人是否为群组管理员',
    toast_st_create_failed_detail: '❌ 创建话题失败，可能话题名称重复或机器人权限不足',
    toast_back_spamtopic: '已返回垃圾话题菜单',
    st_config_prompt: '⚙️ <b>配置垃圾话题 ID</b>\n\n当前话题 ID：<code>{id}</code>\n\n<b>使用方法：</b>\n1. 在群组中手动创建一个话题\n2. 复制话题 ID（可以通过转发话题中的消息获取）\n3. 发送话题 ID 完成配置\n\n<b>或者：</b>\n• 发送「自动创建」或 "auto create" 让机器人自动创建话题\n• 发送「取消」或 "cancel" 放弃配置',
    toast_st_config_ask: '请发送话题 ID 或「自动创建」',
    st_view_title: '📊 <b>查看垃圾消息</b>',
    st_view_topic_id: '<b>垃圾话题 ID：</b> <code>{id}</code>',
    st_view_link: '<b>话题链接：</b> ',
    st_view_open_link: '点击跳转',
    st_view_stats_title: '<b>统计信息：</b>',
    st_view_enabled: '垃圾话题功能：{status}',
    st_view_notify: '管理员通知：{icon}',
    st_view_desc: '<b>说明：</b>\n• 所有被标记为垃圾的消息会自动转发到垃圾话题\n• 您可以在话题中查看和恢复误判的消息\n• 恢复消息请回复该消息并发送 /restore',
    st_view_actions: '<b>快捷操作：</b>\n• 点击话题链接直接跳转到 Telegram 话题\n• 返回菜单可重新查看',
    btn_open_topic: '🔗 打开话题',
    toast_st_view_shown: '已显示垃圾话题信息',
    toast_st_no_topic: '❌ 未配置垃圾话题，请先创建或配置话题 ID',
    st_config_cancelled: '❌ 已取消配置垃圾话题 ID',
    st_auto_created: '✅ 垃圾话题已自动创建，ID：<code>{id}</code>\n\n请在菜单中开启垃圾话题功能',
    st_auto_create_failed: '❌ 自动创建失败，请检查机器人是否为群组管理员',
    st_invalid_id: '❌ 无效的话题 ID，请输入纯数字或话题链接',
    st_id_set: '✅ 垃圾话题 ID 已设置：<code>{id}</code>\n\n请在菜单中开启垃圾话题功能',
    fwd_title: '💬 <b>消息转发模式</b>',
    fwd_current: '当前模式：<b>{mode}</b>',
    fwd_mode_topic_label: '话题模式（论坛群组）',
    fwd_mode_direct_label: '私聊模式（管理员私聊）',
    fwd_desc: '<b>说明：</b>\n• 私聊模式：所有消息只发到管理员私聊\n• 话题模式：每个访客自动创建话题，消息转发到论坛群组',
    fwd_prereq_title: '<b>启用话题模式前请完成：</b>',
    fwd_issue_group: '• 未设置 GROUP_ID 环境变量',
    fwd_issue_admin: '• 未设置 ENV_ADMIN_UID（主管理员）',
    fwd_ready: '✅ 话题模式条件已满足，可随时开启。',
    fwd_note: '在话题模式下，请确保机器人是群组管理员并具备「管理话题」权限。',
    btn_fwd_direct: '📥 私聊转发', btn_fwd_topic: '💬 话题转发',
    toast_fwd_need_config: '⚠️ 请先在环境变量中配置 GROUP_ID 和 ENV_ADMIN_UID',
    toast_fwd_topic_unavailable: '话题模式不可用：{issue}',
    toast_fwd_switched_topic: '已切换到话题模式', toast_fwd_switched_direct: '已切换到私聊模式',
    verify_title: '🔐 <b>验证模式设置</b>',
    verify_current: '当前模式：<b>{mode}</b>',
    verify_options_title: '<b>可选模式：</b>',
    verify_options_block: '📝 <b>本地题库</b> - 使用内置简单题目验证（默认，无需配置）\n☁️ <b>Turnstile</b> - 使用 Cloudflare Turnstile 网页验证\n🔒 <b>双重验证</b> - 需要同时通过两种验证',
    verify_turnstile_missing: '⚠️ <b>注意：</b> 未检测到 Turnstile 配置，只能使用本地题库验证。\n请在环境变量中配置 CF_TURNSTILE_SITE_KEY 和 CF_TURNSTILE_SECRET_KEY 后使用其他模式。',
    union_title: '🌐 <b>联合封禁设置</b>',
    union_status: '当前状态：{status}',
    union_desc: '联合封禁可以自动拦截已被其他服务标记为恶意的用户。',
    union_tap: '点击下方按钮切换状态。',
    btn_union_on: '🟢 开启联合封禁', btn_union_off: '🔴 关闭联合封禁',
    toast_union_on: '联合封禁已开启', toast_union_off: '联合封禁已关闭',
    welcome_title: '👋 <b>欢迎消息设置</b>',
    welcome_current: '📄 <b>当前内容：</b>',
    welcome_not_set: '(未设置，使用默认消息)',
    welcome_howto: '💡 <b>使用方法：</b>\n• 发送 <code>/welcome 消息内容</code> 设置新消息\n• 发送 <code>/welcome delete</code> 删除并使用默认\n\n访客首次联系机器人时会看到此消息。',
    autoreply_title: '✉️ <b>自动回复设置</b>',
    autoreply_current: '📄 <b>当前内容：</b>',
    autoreply_not_set: '(已关闭)',
    autoreply_howto: '💡 <b>使用方法：</b>\n• 发送 <code>/autoreply 消息内容</code> 设置自动回复\n• 发送 <code>/autoreply off</code> 关闭自动回复\n\n已验证访客发送消息时会收到此回复。',
    stats_title: '📊 <b>统计信息</b>',
    stats_today: '📅 <b>今日数据（{date}）</b>',
    stats_today_messages: '消息数：{count}',
    stats_today_active: '活跃用户：{count}',
    stats_total_title: '📈 <b>累计数据</b>',
    stats_total_messages: '总消息数：{count}',
    stats_note: '💡 数据每小时自动更新。',
    users_title: '👥 <b>用户管理</b>',
    filter_all: '全部用户', filter_whitelisted: '信任用户', filter_blocked: '拉黑用户',
    filter_all_short: '全部', filter_whitelisted_short: '信任', filter_blocked_short: '拉黑',
    users_summary: '📊 全部 {total} | 信任 {whitelisted} | 拉黑 {blocked}',
    users_empty: '暂无匹配用户。',
    users_page_info: '第 {page}/{totalPages} 页',
    users_hint: '💡 点击下方序号按钮即可管理对应用户。',
    users_trusted_tag: '信任', users_blocked_tag: '拉黑',
    btn_prev_page: '◀️ 上页', btn_next_page: '下页 ▶️',
    user_uid_line: '🆔 UID：<code>{uid}</code>',
    user_status_line: '状态：{icon} {status}',
    user_status_trusted: '已信任', user_status_blocked: '已拉黑', user_status_normal: '普通用户',
    user_choose_action: '请选择操作：',
    btn_trust: '⭐ 信任', btn_untrust: '❌ 取消信任',
    btn_block: '🚫 拉黑', btn_unblock: '✅ 解封',
    btn_back_users: '← 返回用户列表',
    toast_page: '第 {page} 页',
    toast_filter_switched: '已切换：{filter}',
    toast_refreshed: '已刷新',
    toast_user_trusted: '已信任用户 {userId}', toast_user_untrusted: '已取消信任用户 {userId}',
    toast_user_blocked: '已拉黑用户 {userId}', toast_user_unblocked: '已解封用户 {userId}',
    help_title: '✨ <b>SafeRelay 管理面板</b>',
    help_common_title: '<b>常用：</b>',
    help_user_mgmt_title: '<b>用户（回复消息或带 ID）：</b>',
    help_msg_settings_title: '<b>消息：</b>',
    help_forward_system_title: '<b>系统：</b>',
    help_forward_switch_note: '转发模式：在 /menu → 💬 转发 中切换',
    help_shortcut_note: '<b>快捷操作：</b> 直接回复访客消息即可回信',
    help_footer: '<i>验证：{verifyMode} | 过滤：{filterStatus}</i>',
    help_body: '<b>常用：</b>\n/menu - 管理面板\n/help - 本帮助\n/language - 切换语言\n/broadcast - 广播给所有访客\n/bcancel - 取消广播\n\n<b>用户（回复消息或带 ID）：</b>\n/ban - 封禁\n/unban - 解封\n/reset - 重置验证\n/trust - 信任（跳过检查）\n/untrust - 取消信任\n\n<b>消息：</b>\n/welcome - 欢迎消息\n/autoreply - 自动回复\n\n<b>系统：</b>\n/cleanup - 清理失效话题\n/cachestats - 缓存统计\n/clearcache - 清空缓存\n转发模式：在 /menu → 💬 转发 中切换\n\n<b>快捷操作：</b> 直接回复访客消息即可回信',
    welcome_deleted: '✅ 欢迎消息已删除（恢复默认）。',
    welcome_set: '✅ 欢迎消息已设置。',
    autoreply_off_done: '✅ 自动回复已关闭。',
    autoreply_set: '✅ 自动回复已设置。',
    kw_allow_added: '✅ 已添加放行关键词：<code>{keyword}</code>',
    kw_already_exists: '⚠️ 该放行关键词已存在。',
    kw_regex_added: '✅ 已添加正则规则：<code>{regex}</code>',
    kw_regex_invalid: '❌ 正则表达式无效。',
    kw_block_deleted: '✅ 已删除拦截关键词：<code>{keyword}</code>',
    kw_block_not_found: '⚠️ 未找到该拦截关键词。',
    kw_allow_deleted: '✅ 已删除放行关键词：<code>{keyword}</code>',
    kw_allow_not_found: '⚠️ 未找到该放行关键词。',
    kw_rules_reset_done: '✅ 已重置为默认规则。',
    max_links_set: '✅ 链接限制已设置为：{count}',
    invalid_number: '⚠️ 请输入有效的数字。',
    kw_added: '✅ 已添加拦截关键词：<code>{keyword}</code>\n发送 del:{keyword} 删除',
    kw_manage_general_only: 'ℹ️ 关键词管理只能在 General 话题或私聊中进行。\n\n当前在访客话题中，消息将转发给该访客。',
    ban_success: '🚫 用户 <code>{id}</code> 已被封禁。',
    ban_usage: '⚠️ 格式错误。\n请回复访客消息发送 /ban\n或发送 /ban 123456（必须是数字 ID）',
    unban_success: '✅ 用户 <code>{id}</code> 已解封。',
    unban_usage: '⚠️ 格式错误。\n请回复访客消息发送 /unban\n或发送 /unban 123456（必须是数字 ID）',
    reset_whitelist_warning: '⚠️ 用户 <code>{id}</code> 在信任名单中，无需验证即可发送消息。\n\n如需限制该用户，请先取消其信任状态。',
    reset_success: '🔄 用户 <code>{id}</code> 验证状态已取消。',
    reset_usage: '⚠️ 格式错误。\n请回复访客消息发送 /reset\n或发送 /reset 123456（必须是数字 ID）',
    broadcast_usage: '⚠️ 格式错误。\n用法：/broadcast 消息内容\n\n支持 HTML 格式：\n<b>粗体</b> <i>斜体</i> <code>代码</code>',
    broadcast_cooldown: '⏳ 广播冷却中，请 {hours} 小时后再试。',
    broadcast_cooldown_limit: '⏳ 广播冷却中，请 {hours} 小时后再试。\n\n限额：{limit} 次 / 24 小时',
    broadcast_title_done: '广播完成', broadcast_title_partial: '广播部分完成（超时）',
    broadcast_sent_line: '✅ 已发送：{sent}/{total}',
    broadcast_failed_line: '❌ 失败：{failed}',
    broadcast_skipped_line: '⏭️ 跳过（封禁）：{skipped}',
    btn_bc_continue: '▶️ 继续发送', btn_bc_cancel: '❌ 取消广播',
    toast_bc_sending: '正在发送...', toast_bc_expired: '广播已过期',
    broadcast_expired_text: '❌ 广播消息已过期或被取消',
    broadcast_cancelled_text: '✅ 已取消广播',
    toast_cancelled: '已取消',
    trust_success: '✅ 已信任用户 <code>{id}</code>',
    trust_hint: '📋 请回复访客消息或发送 /trust 123456 来信任用户',
    untrust_success: '✅ 已取消信任用户 <code>{id}</code>',
    untrust_hint: '📋 请回复访客消息或发送 /untrust 123456 来取消信任',
    bcancel_done: '✅ 已取消广播',
    cache_stats_text: '⚡ <b>缓存统计信息</b>\n\n<b>L1 内存缓存：</b>\n  命中：{l1Hits}\n  未命中：{l1Misses}\n  命中率：{l1Rate}\n  缓存大小：{l1Size} 条目\n\n<b>L2 KV 缓存：</b>\n  命中：{l2Hits}\n  未命中：{l2Misses}\n  命中率：{l2Rate}\n\n<i>提示：命中率越高，性能越好</i>',
    clearcache_done: '✅ 已清空所有缓存\n\nL1 内存缓存和统计信息已重置。\nL2 KV 缓存将在到期后自动清理。',
    restore_not_enabled: '⚠️ 垃圾话题功能未启用，无法恢复消息。',
    restore_wrong_topic: '⚠️ 请回复垃圾话题中的消息来恢复。\n\n提示：只有垃圾话题中的消息才能被恢复。',
    restore_success_topic: '✅ 消息已恢复到访客话题\n\n🆔 UID：<code>{uid}</code>\n话题 ID：<code>{topicId}</code>',
    restore_success_dm: '✅ 消息已恢复并发送给访客\n\n🆔 UID：<code>{uid}</code>',
    restore_no_mapping: '⚠️ 未找到消息映射关系，无法恢复。\n\n可能原因：消息映射已过期（超过 48 小时）或消息不是通过垃圾话题功能转发的。',
    restore_failed: '❌ 恢复消息失败，请稍后重试。',
    invalid_command_topic: '⚠️ 无效命令「{cmd}」\n\n请发送 /help 查看所有可用指令。',
    invalid_command: '⚠️ 无效命令「{cmd}」\n\n请检查命令拼写，或发送 /help 查看所有可用指令。',
    no_mapping_old: '⚠️ 未找到原访客映射，可能消息太旧或缓存已被清理。',
    help_hint: '🤖 发送 /help 查看全部指令，或直接回复访客消息回信。',
    spam_rules_updated: '✅ 垃圾过滤规则已更新',
    cleanup_no_group: '⚠️ 未配置 GROUP_ID 环境变量\n\n话题清理功能仅在使用论坛群组时需要。\n请在 Cloudflare 环境变量中设置 GROUP_ID。',
    cleanup_scan_dry: '🔍 <b>开始扫描失效话题（预览模式）</b>',
    cleanup_scan: '🧽 <b>开始清理失效话题</b>',
    cleanup_scanning: '正在扫描用户数据...',
    cleanup_progress: '进度：{done}/{total}\n已发现失效：{invalid}',
    cleanup_progress_cleaned: '已清理：{cleaned}',
    cleanup_done_title: '✅ <b>清理完成</b>',
    cleanup_stats_title: '📊 <b>统计信息：</b>',
    cleanup_total_users: '总用户数：{count}',
    cleanup_invalid_topics: '失效话题：{count}',
    cleanup_cleaned: '已清理：{count}',
    cleanup_preview_note: '预览模式：未执行清理',
    cleanup_errors: '错误：{count}',
    cleanup_invalid_list_title: '<b>失效用户列表：</b>',
    cleanup_more: '... 还有 {count} 个',
    cleanup_failed: '❌ <b>清理失败</b>\n\n错误信息：{error}\n\n请检查日志或重试。'
  }
};

function t(lang, key, vars = {}) {
  const normalized = normalizeLang(lang) || getDefaultLang();
  const dict = I18N[normalized] || I18N.en;
  let str = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
  if (vars && typeof str === 'string') {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : m));
  }
  return str;
}

function languageKeyboard() {
  return { inline_keyboard: [[
    { text: 'English', callback_data: 'lang_set:en' },
    { text: '简体中文', callback_data: 'lang_set:zh' }
  ]] };
}

function guestLanguageKeyboard(lang) {
  return { inline_keyboard: [[
    { text: t(lang, 'btn_language'), callback_data: 'submenu_language' }
  ]] };
}

async function generateLanguageSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const currentName = t(L, L === 'zh' ? 'language_current_zh' : 'language_current_en');
  const text = t(L, 'language_prompt', { current: currentName });
  return { text, reply_markup: languageKeyboard() };
}

async function sendLanguageMenu(chatId, userId, extra = {}) {
  const lang = await getUserLang(userId);
  const menu = await generateLanguageSubmenu(lang);
  return sendMessage({ chat_id: chatId, text: menu.text, parse_mode: 'HTML', reply_markup: menu.reply_markup, ...extra });
}

async function handleLanguageCallback(callbackQuery) {
  const data = callbackQuery.data || '';
  const userId = String(callbackQuery.from.id);
  const chatId = callbackQuery.message ? callbackQuery.message.chat.id : userId;
  const messageId = callbackQuery.message ? callbackQuery.message.message_id : null;
  if (data === 'submenu_language' || data === 'lang_menu') {
    const lang = await getUserLang(userId);
    const menu = await generateLanguageSubmenu(lang);
    if (isAdmin(userId)) menu.reply_markup.inline_keyboard.push([{ text: t(lang, 'btn_back_main'), callback_data: 'back_to_main' }]);
    if (messageId && isAdmin(userId)) {
      await requestTelegram('editMessageText', { chat_id: chatId, message_id: messageId, text: menu.text, parse_mode: 'HTML', reply_markup: menu.reply_markup }).catch(() => null);
    } else {
      await sendMessage({ chat_id: chatId, text: menu.text, parse_mode: 'HTML', reply_markup: menu.reply_markup });
    }
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }
  if (data.startsWith('lang_set:')) {
    const newLang = normalizeLang(data.split(':')[1]) || getDefaultLang();
    await setUserLang(userId, newLang);
    const confirmText = t(newLang, 'language_changed');
    if (isAdmin(userId) && messageId) {
      const menu = await generateMainMenu(newLang);
      await requestTelegram('editMessageText', { chat_id: chatId, message_id: messageId, text: menu.text, parse_mode: 'HTML', reply_markup: menu.reply_markup }).catch(() => null);
      await sendMessage({ chat_id: chatId, text: confirmText });
    } else if (messageId) {
      await requestTelegram('editMessageText', { chat_id: chatId, message_id: messageId, text: confirmText }).catch(() => null);
    } else {
      await sendMessage({ chat_id: chatId, text: confirmText });
    }
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: confirmText });
  }
  return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
}

// 验证通过后的有效期 (秒)，默认 7 天
const VERIFICATION_TTL = 60 * 60 * 24 * 7;

// ========== 高级功能配置 ==========
const CONFIG = {
  // 消息暂存队列
  PENDING_MAX_MESSAGES: 10,           // 验证期间最多暂存消息数量
  PENDING_QUEUE_TTL_SECONDS: 86400,   // 暂存消息队列 TTL（秒）

  // KV 配额熔断保护
  KV_QUOTA_BREAKER_KEY: '__kv_quota_exceeded__',
  KV_QUOTA_NOTICE_COOLDOWN: 300,      // 5 分钟内只通知一次
  KV_QUOTA_BREAKER_TTL: 60,           // 熔断器持续时间（秒）

  // 用户资料缓存
  USER_PROFILE_CACHE_TTL: 86400,      // 用户资料缓存时间（秒）
  USER_PROFILE_COOLDOWN: 3600,        // 同一用户资料更新冷却（秒）

  // API 超时配置
  API_TIMEOUT_MS: 10000,              // Telegram API 调用超时（毫秒）

  // 验证并发保护
  VERIFY_LOCK_TTL_SECONDS: 60,        // 验证锁过期时间

  // 话题健康检查配置
  THREAD_HEALTH_TTL_MS: 30 * 60 * 1000,  // 话题健康状态缓存 TTL（30 分钟）
  THREAD_HEALTH_CHECK_TIMEOUT_MS: 5000,  // 话题探测超时（5 秒）

  // Workers AI 配置
  AI_SPAM_DETECTION_ENABLED: false,   // AI 垃圾检测开关（默认关闭）
  AI_MODEL_ID: '@cf/meta/llama-3.2-3b-instruct',  // AI 模型
  AI_CONFIDENCE_THRESHOLD: 0.7,       // AI 置信度阈值
  AI_RATE_LIMIT_PER_HOUR: 100,        // AI 每小时调用次数限制

  // 垃圾话题管理配置
  SPAM_TOPIC_ENABLED: false,          // 垃圾话题功能开关
  SPAM_TOPIC_ID: null,                // 垃圾话题 ID（可选，用于静默转发）

  // 数据安全性配置
  TURNSTILE_SESSION_TTL_MS: 10 * 60 * 1000, // Turnstile 会话有效期
};
const textEncoder = new TextEncoder();
let verificationSignKeyPromise = null;

function parseAdminIdList(primaryId, allowlistEnv) {
  const ids = [];
  const pushId = (value) => {
    if (!value && value !== 0) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    if (!/^-?\d+$/.test(normalized)) return;
    if (!ids.includes(normalized)) {
      ids.push(normalized);
    }
  };

  pushId(primaryId);
  if (allowlistEnv) {
    String(allowlistEnv).split(/[,;\s]+/).forEach(pushId);
  }
  return ids;
}

function getTurnstileSiteKey() {
  return (getEnv('CF_TURNSTILE_SITE_KEY') || '').trim();
}

function getTurnstileSecretKey() {
  return (getEnv('CF_TURNSTILE_SECRET_KEY') || '').trim();
}

function getTurnstileAllowedHostnames() {
  const raw = (getEnv('TURNSTILE_ALLOWED_HOSTNAMES') || '').trim();
  if (!raw) return [];
  return raw.split(/[,;\s]+/).map(h => h.trim()).filter(Boolean);
}

function getTurnstileExpectedAction() {
  return (getEnv('TURNSTILE_ACTION') || '').trim();
}

function getVerificationSigningSecret() {
  return (getEnv('VERIFY_SIGNING_SECRET') || SECRET || TOKEN || '').toString();
}

async function getVerificationSignKey() {
  if (!verificationSignKeyPromise) {
    verificationSignKeyPromise = crypto.subtle.importKey(
      'raw',
      textEncoder.encode(getVerificationSigningSecret() || 'saferelay-signing-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }
  return verificationSignKeyPromise;
}

async function signVerificationPayload(payload) {
  const key = await getVerificationSignKey();
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return bufferToBase64Url(signature);
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}


// ========== 安全工具函数 ==========

/**
 * 加密安全的随机整数生成
 * @param {number} min - 最小值（包含）
 * @param {number} max - 最大值（不包含）
 * @returns {number} 随机整数
 */
function secureRandomInt(min, max) {
  const range = max - min;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return min + (bytes[0] % range);
}

/**
 * 加密安全的随机 ID 生成
 * @param {number} length - ID 长度
 * @returns {string} 随机字符串
 */
function secureRandomId(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/**
 * 安全的 JSON 读取函数
 * 防止 KV 数据损坏或类型错误导致崩溃
 * @param {string} key - KV 键名
 * @param {any} defaultValue - 默认值
 * @returns {Promise<any>} 解析后的数据或默认值
 */
async function safeGetJSON(key, defaultValue = null) {
  try {
    const data = await KV.get(key);
    if (data === null || data === undefined) {
      return defaultValue;
    }
    const parsed = JSON.parse(data);
    // 确保返回的是对象类型（用于对象默认值）
    if (defaultValue !== null && typeof defaultValue === 'object' && typeof parsed !== 'object') {
      Logger.warn('kv_invalid_type', { key, expected: 'object', actual: typeof parsed });
      return defaultValue;
    }
    return parsed;
  } catch (e) {
    Logger.error('kv_parse_failed', e, { key });
    return defaultValue;
  }
}

/**
 * 恒定时间字符串比较（防止时序攻击）
 * @param {string} a - 字符串 a
 * @param {string} b - 字符串 b
 * @returns {boolean} 是否相等
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

const TURNSTILE_SESSION_PREFIX = 'turnstile_session:';

async function createTurnstileSession(userId) {
  const sessionId = secureRandomId(32);
  const expiresAt = Date.now() + CONFIG.TURNSTILE_SESSION_TTL_MS;
  const payload = `${sessionId}.${userId}.${expiresAt}`;
  const signature = await signVerificationPayload(payload);
  await KV.put(
    `${TURNSTILE_SESSION_PREFIX}${sessionId}`,
    JSON.stringify({ userId, expiresAt }),
    { expirationTtl: Math.ceil(CONFIG.TURNSTILE_SESSION_TTL_MS / 1000) }
  );
  return { sessionId, signature, expiresAt };
}

async function validateTurnstileSession(sessionId, signature) {
  if (!sessionId || !signature) {
    return { valid: false };
  }

  const stored = await KV.get(`${TURNSTILE_SESSION_PREFIX}${sessionId}`);
  if (!stored) {
    return { valid: false };
  }

  let data;
  try {
    data = JSON.parse(stored);
  } catch (e) {
    Logger.error('turnstile_session_parse_failed', e);
    await KV.delete(`${TURNSTILE_SESSION_PREFIX}${sessionId}`);
    return { valid: false };
  }

  if (!data || !data.userId || !data.expiresAt) {
    await KV.delete(`${TURNSTILE_SESSION_PREFIX}${sessionId}`);
    return { valid: false };
  }

  if (Date.now() > data.expiresAt) {
    await KV.delete(`${TURNSTILE_SESSION_PREFIX}${sessionId}`);
    return { valid: false };
  }

  const expectedPayload = `${sessionId}.${data.userId}.${data.expiresAt}`;
  const expectedSig = await signVerificationPayload(expectedPayload);
  if (!constantTimeCompare(expectedSig, signature)) {
    return { valid: false };
  }

  return { valid: true, userId: data.userId };
}

async function consumeTurnstileSession(sessionId) {
  if (!sessionId) return;
  try {
    await KV.delete(`${TURNSTILE_SESSION_PREFIX}${sessionId}`);
  } catch (e) {
    Logger.warn('turnstile_session_delete_failed', { sessionId, error: e.message });
  }
}

// ========== 本地题库验证配置 ==========
// 验证模式: 'local_quiz'(默认本地题库) / 'turnstile'(Turnstile网页验证) / 'both'(两者都需要)
const VERIFY_MODE_DEFAULT = 'local_quiz';

// 本地题库题目
const LOCAL_QUIZ_QUESTIONS = [
  { q: { en: "What does ice turn into when it melts?", zh: "冰融化后会变成什么？" }, opts: { en: ["Water", "Stone", "Wood", "Fire"], zh: ["水", "石头", "木头", "火"] }, a: 0 },
  { q: { en: "How many eyes does a person normally have?", zh: "正常人有几只眼睛？" }, opts: { en: ["1", "2", "3", "4"], zh: ["1", "2", "3", "4"] }, a: 1 },
  { q: { en: "Which of the following is a fruit?", zh: "以下哪个属于水果？" }, opts: { en: ["Cabbage", "Banana", "Pork", "Rice"], zh: ["白菜", "香蕉", "猪肉", "大米"] }, a: 1 },
  { q: { en: "What is 1 + 2?", zh: "1 加 2 等于几？" }, opts: { en: ["2", "3", "4", "5"], zh: ["2", "3", "4", "5"] }, a: 1 },
  { q: { en: "What is 5 - 2?", zh: "5 减 2 等于几？" }, opts: { en: ["1", "2", "3", "4"], zh: ["1", "2", "3", "4"] }, a: 2 },
  { q: { en: "What is 2 x 3?", zh: "2 乘以 3 等于几？" }, opts: { en: ["4", "5", "6", "7"], zh: ["4", "5", "6", "7"] }, a: 2 },
  { q: { en: "What is 10 + 5?", zh: "10 加 5 等于几？" }, opts: { en: ["10", "12", "15", "20"], zh: ["10", "12", "15", "20"] }, a: 2 },
  { q: { en: "What is 8 - 4?", zh: "8 减 4 等于几？" }, opts: { en: ["2", "3", "4", "5"], zh: ["2", "3", "4", "5"] }, a: 2 },
  { q: { en: "Which vehicle flies in the sky?", zh: "在天上飞的交通工具是什么？" }, opts: { en: ["Car", "Boat", "Airplane", "Bicycle"], zh: ["汽车", "轮船", "飞机", "自行车"] }, a: 2 },
  { q: { en: "What day comes after Monday?", zh: "星期一的后面是星期几？" }, opts: { en: ["Sunday", "Friday", "Tuesday", "Wednesday"], zh: ["星期日", "星期五", "星期二", "星期三"] }, a: 2 },
  { q: { en: "Where do fish usually live?", zh: "鱼通常生活在哪里？" }, opts: { en: ["In trees", "In soil", "In water", "In fire"], zh: ["树上", "土里", "水里", "火里"] }, a: 2 },
  { q: { en: "Which organ do we use to hear sounds?", zh: "我们用什么器官来听声音？" }, opts: { en: ["Eyes", "Nose", "Ears", "Mouth"], zh: ["眼睛", "鼻子", "耳朵", "嘴巴"] }, a: 2 },
  { q: { en: "What color is a clear sky usually?", zh: "晴朗的天空通常是什么颜色的？" }, opts: { en: ["Green", "Red", "Blue", "Purple"], zh: ["绿色", "红色", "蓝色", "紫色"] }, a: 2 },
  { q: { en: "From which direction does the sun rise?", zh: "太阳从哪个方向升起？" }, opts: { en: ["West", "South", "East", "North"], zh: ["西方", "南方", "东方", "北方"] }, a: 2 },
  { q: { en: "What sound does a dog usually make?", zh: "小狗发出的叫声通常是？" }, opts: { en: ["Meow", "Baa", "Woof", "Ribbit"], zh: ["喵喵", "咩咩", "汪汪", "呱呱"] }, a: 2 },
];

// 本地题库验证配置
const LOCAL_QUIZ_CONFIG = {
  CHALLENGE_TTL_SECONDS: 60,          // 单题有效期60秒
  TRIGGER_WINDOW_SECONDS: 300,        // 5分钟窗口
  TRIGGER_LIMIT: 3,                   // 5分钟最多触发3次
  MAX_ATTEMPTS: 3,                    // 每题最多尝试次数
};

// KV Key 常量
const KV_KEYS = {
  VERIFY_MODE: 'config:verify_mode',  // 验证模式配置
  SPAM_FILTER_ENABLED: 'config:spam_filter_enabled',  // 垃圾过滤开关
  SPAM_FILTER_RULES: 'config:spam_filter_rules',      // 垃圾过滤规则
  AI_SPAM_DETECTION: 'config:ai_spam_detection',      // AI 垃圾检测配置
  AI_USAGE_COUNT: 'stats:ai_usage:',                  // AI 使用统计（按小时）
  SPAM_TOPIC_CONFIG: 'config:spam_topic',              // 垃圾话题配置
};

// ========== 垃圾消息过滤配置 ==========
// 默认垃圾过滤规则
const DEFAULT_SPAM_RULES = {
  maxLinks: 3,                 // 最多允许3个链接
  keywords: [                  // 关键词列表
    "加群", "进群", "推广", "广告", "返利", "博彩", "代投", "套利",
    "USDT", "BTC", "ETH", "币圈", "空投", "交易所", "稳赚", "客服", "开户链接",
    "刷单", "兼职", "日赚", "高回报", "零风险", "投资", "理财", "赚钱"
  ],
  regexes: [                   // 正则表达式列表
    "\\b(?:usdt|btc|eth|trx|bnb)\\b",
    "(?:t\\.me/\\w+|telegram\\.me/\\w+)",
    "(?:免费|稳赚|日赚|高回报|带单|私聊我|加我)"
  ],
  allowKeywords: [],           // 放行关键词（白名单）
  allowRegexes: []             // 放行正则
};

// 结构化日志系统
// 【安全加固】所有日志输出前都会通过 sanitizeLogValue 进行脱敏，防止 Bot Token、
// Turnstile 密钥、HMAC 签名等敏感信息泄露到 Cloudflare Logs。
const SENSITIVE_PATTERNS = [
  // Telegram Bot Token: 123456:ABC-DEF...
  { re: /\bbot\d{6,}:[A-Za-z0-9_-]{20,}/g, replace: 'bot***:***' },
  { re: /\b\d{6,12}:[A-Za-z0-9_-]{30,}/g, replace: '***:***' },
  // Cloudflare Turnstile 密钥前缀（site key 与 secret key 都是 0x4AAA... 开头）
  { re: /\b0x4[A-Za-z0-9]{20,}/g, replace: '0x***' },
  // Authorization Bearer token
  { re: /Bearer\s+[A-Za-z0-9._\-]+/gi, replace: 'Bearer ***' },
  // URL 查询参数中常见敏感字段（sig=、secret=、token=、key=）
  { re: /([?&](?:sig|signature|secret|token|key|secret_token)=)[^&\s"']+/gi, replace: '$1***' }
];

// 已知敏感字段名（对象键级别）
const SENSITIVE_KEYS = new Set([
  'token', 'secret', 'signature', 'sig', 'authorization',
  'env_bot_token', 'env_bot_secret', 'cf_turnstile_site_key',
  'cf_turnstile_secret_key', 'verify_signing_secret', 'cf_ai_token',
  'password', 'apikey', 'api_key'
]);

function sanitizeLogString(str) {
  if (typeof str !== 'string' || !str) return str;
  let out = str;
  for (const { re, replace } of SENSITIVE_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

function sanitizeLogValue(value, depth = 0) {
  if (depth > 6) return '[Truncated]';
  if (value == null) return value;
  const type = typeof value;
  if (type === 'string') return sanitizeLogString(value);
  if (type === 'number' || type === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map(v => sanitizeLogValue(v, depth + 1));
  }
  if (type === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
        out[k] = '***';
      } else {
        out[k] = sanitizeLogValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function stringifyLog(payload) {
  try {
    return JSON.stringify(sanitizeLogValue(payload));
  } catch (e) {
    // 兜底：循环引用等情况
    return JSON.stringify({ level: payload.level || 'UNKNOWN', action: payload.action || 'log_serialize_failed', error: e.message });
  }
}

const Logger = {
  info(action, data = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      action,
      ...data
    };
    console.log(stringifyLog(log));
  },

  warn(action, errorOrData = {}, data = {}) {
    let payload = {};
    if (errorOrData instanceof Error) {
      payload = { error: errorOrData.message, stack: errorOrData.stack, ...data };
    } else {
      payload = { ...errorOrData, ...data };
    }
    const log = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      action,
      ...payload
    };
    console.warn(stringifyLog(log));
  },

  error(action, error, data = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      action,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...data
    };
    console.error(stringifyLog(log));
  },

  debug(action, data = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      action,
      ...data
    };
    console.log(stringifyLog(log));
  },

  /**
   * 创建带上下文的日志记录器
   * @param {object} context - 上下文数据（如 userId, chatId 等）
   * @returns {object} 带上下文的日志方法
   */
  withContext(context) {
    return {
      info: (action, data = {}) => Logger.info(action, { ...context, ...data }),
      warn: (action, errorOrData = {}, data = {}) => Logger.warn(action, errorOrData, { ...context, ...data }),
      error: (action, error, data = {}) => Logger.error(action, error, { ...context, ...data }),
      debug: (action, data = {}) => Logger.debug(action, { ...context, ...data })
    };
  }
};

// 防刷屏配置（精细化速率限制）
const RATE_LIMIT_CONFIG = {
  // 普通消息频率限制
  message: {
    windowMs: 5000,      // 5 秒窗口
    maxRequests: 5,      // 最多 5 条消息
    keyPrefix: 'ratelimit:msg'
  },
  // 验证请求频率限制
  verify: {
    windowMs: 300000,    // 5 分钟窗口
    maxRequests: 3,      // 最多 3 次验证请求
    keyPrefix: 'ratelimit:verify'
  },
  // 验证答案尝试限制
  verifyAttempt: {
    windowMs: 60000,     // 1 分钟窗口
    maxRequests: 5,      // 最多 5 次尝试
    keyPrefix: 'ratelimit:attempt'
  },
  // 广播消息频率限制
  broadcast: {
    windowMs: 86400000,  // 24 小时窗口
    maxRequests: 1,      // 每天 1 次广播
    keyPrefix: 'ratelimit:broadcast'
  },
  // AI 检测频率限制
  aiDetect: {
    windowMs: 3600000,   // 1 小时窗口
    maxRequests: 100,    // 每小时 100 次 AI 检测
    keyPrefix: 'ratelimit:ai'
  },
  // 管理命令频率限制
  adminCommand: {
    windowMs: 60000,     // 1 分钟窗口
    maxRequests: 30,     // 每分钟 30 次命令
    keyPrefix: 'ratelimit:admin'
  }
};

// 限流增强配置
const RATE_LIMIT_ENHANCED = {
  // 是否启用分级限流（根据用户行为动态调整）
  enabledDynamicLimit: true,
  // 可信用户倍率（信任用户更宽松）
  trustedUserMultiplier: 2,
  // 新用户倍率（新用户更严格）
  newUserMultiplier: 0.5,
  // 最大累积惩罚次数
  maxPenaltyCount: 10,
  // 惩罚冷却时间（毫秒）
  penaltyCooldownMs: 300000  // 5 分钟
};

// 联合封禁配置
const UNION_BAN_API_URL = "https://verify.wzxabc.eu.org";
const UNION_BAN_CACHE_TTL = 3600 * 24;

// 本地欺诈数据库配置
const FRAUD_DB_URL = 'https://raw.githubusercontent.com/qianqi32/SafeRelay/main/data/fraud.db';
const FRAUD_CACHE_TTL = 3600; // 1小时缓存

// 调用联合封禁 API
async function callUnionBanApi(endpoint, payload) {
  try {
    const baseUrl = UNION_BAN_API_URL.endsWith('/') ? UNION_BAN_API_URL.slice(0, -1) : UNION_BAN_API_URL;
    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      Logger.error('union_ban_api_error', new Error(`HTTP ${resp.status}`), { endpoint });
      return null;
    }
    return await resp.json();
  } catch (e) {
    Logger.error('union_ban_api_network_error', e, { endpoint });
    return null;
  }
}

// 检查用户是否被联合封禁
async function checkUnionBan(userId) {
  const gbanKey = `gban:${userId}`;

  let gbanStatus = memGet(gbanKey);
  if (gbanStatus !== undefined) {
    return gbanStatus === "true";
  }

  gbanStatus = await cacheApiGet(gbanKey);
  if (gbanStatus !== undefined) {
    memSet(gbanKey, gbanStatus, 30 * 60 * 1000);
    return gbanStatus === "true";
  }

  gbanStatus = await KV.get(gbanKey);
  if (gbanStatus !== null) {
    memSet(gbanKey, gbanStatus, 30 * 60 * 1000);
    await cacheApiSet(gbanKey, gbanStatus, 1800);
    return gbanStatus === "true";
  }

  const remoteCheck = await callUnionBanApi('/check_ban', { user_id: String(userId) });
  gbanStatus = (remoteCheck && remoteCheck.banned) ? "true" : "false";

  await KV.put(gbanKey, gbanStatus, { expirationTtl: UNION_BAN_CACHE_TTL });
  memSet(gbanKey, gbanStatus, 30 * 60 * 1000);
  await cacheApiSet(gbanKey, gbanStatus, 1800);

  return gbanStatus === "true";
}

// 检查用户是否在欺诈数据库中
async function checkFraud(userId) {
  const fraudKey = `fraud:${userId}`;

  let fraudStatus = memGet(fraudKey);
  if (fraudStatus !== undefined) {
    return fraudStatus === "true";
  }

  fraudStatus = await cacheApiGet(fraudKey);
  if (fraudStatus !== undefined) {
    memSet(fraudKey, fraudStatus, FRAUD_CACHE_TTL * 1000);
    return fraudStatus === "true";
  }

  fraudStatus = await KV.get(fraudKey);
  if (fraudStatus !== null) {
    memSet(fraudKey, fraudStatus, FRAUD_CACHE_TTL * 1000);
    await cacheApiSet(fraudKey, fraudStatus, FRAUD_CACHE_TTL);
    return fraudStatus === "true";
  }

  try {
    const db = await fetch(FRAUD_DB_URL).then(r => r.text());
    const fraudList = db.split('\n').filter(v => v.trim());
    const isFraud = fraudList.includes(userId.toString());

    fraudStatus = isFraud ? "true" : "false";

    await KV.put(fraudKey, fraudStatus, { expirationTtl: FRAUD_CACHE_TTL });
    memSet(fraudKey, fraudStatus, FRAUD_CACHE_TTL * 1000);
    await cacheApiSet(fraudKey, fraudStatus, FRAUD_CACHE_TTL);

    return isFraud;
  } catch (err) {
    Logger.error('fraud_db_check_failed', err);
    return false;
  }
}

// ========== 话题健康检查机制 ==========

// 话题健康状态缓存（内存缓存）
const threadHealthCache = new Map();
const topicCreateInFlight = new Map();

/**
 * 验证话题是否有效（带缓存）
 * @param {number} groupId - 群组 ID
 * @param {number} threadId - 话题 ID
 * @returns {Promise<boolean>} 话题是否有效
 */
async function validateForumThread(groupId, threadId) {
  if (!groupId || !threadId) return false;

  const closedStatus = await KV.get(`thread_closed:${threadId}`);
  if (closedStatus === '1') return false;

  const cacheKey = `thread:${threadId}`;
  const now = Date.now();
  const cached = threadHealthCache.get(cacheKey);

  // 检查缓存
  if (cached && (now - cached.ts < CONFIG.THREAD_HEALTH_TTL_MS)) {
    return cached.ok;
  }

  // 缓存过期或不存在，进行健康探测
  const probeResult = await probeForumThread(groupId, threadId);

  // 更新缓存
  threadHealthCache.set(cacheKey, {
    ok: probeResult,
    ts: now
  });

  // 清理过期的缓存条目
  if (threadHealthCache.size > 1000) {
    for (const [key, value] of threadHealthCache.entries()) {
      if (now - value.ts > CONFIG.THREAD_HEALTH_TTL_MS) {
        threadHealthCache.delete(key);
      }
    }
  }

  return probeResult;
}

/**
 * 探测话题是否存在且可用
 * @param {number} groupId - 群组 ID
 * @param {number} threadId - 话题 ID
 * @returns {Promise<boolean>} 话题是否可用
 */
async function probeForumThread(groupId, threadId) {
  if (!groupId || !threadId) return false;
  try {
    const result = await requestTelegram('getForumTopic', {
      chat_id: groupId,
      message_thread_id: threadId
    });

    if (result.ok) {
      const topicInfo = result.result || {};
      if (topicInfo.closed || topicInfo.is_closed) {
        Logger.warn('thread_is_closed', { threadId, groupId });
        return false;
      }
      return true;
    }

    const desc = (result.description || '').toLowerCase();
    if (desc.includes('message thread not found') || desc.includes('topic not found')) {
      Logger.warn('thread_probe_missing', { threadId, groupId, error: result.description });
      return false;
    }
    if (desc.includes('not enough rights')) {
      Logger.warn('thread_probe_permission_denied', { threadId, groupId, error: result.description });
      await verifyTopicEnvironment({ force: true });
      return false;
    }
    if (desc.includes('method not found')) {
      return pingForumThread(groupId, threadId);
    }

    Logger.warn('thread_probe_unknown_error', { threadId, groupId, error: result.description });
    return true;
  } catch (e) {
    Logger.error('thread_probe_error', e, { threadId, groupId });
    return true;
  }
}

async function pingForumThread(groupId, threadId) {
  try {
    const probe = await requestTelegram('sendMessage', {
      chat_id: groupId,
      message_thread_id: threadId,
      text: '.',
      disable_notification: true
    });

    if (probe.ok && probe.result?.message_id) {
      await requestTelegram('deleteMessage', {
        chat_id: groupId,
        message_id: probe.result.message_id
      }).catch(err => Logger.warn('thread_probe_cleanup_failed', err, { groupId, threadId }));
      return true;
    }

    const desc = (probe.description || '').toLowerCase();
    if (desc.includes('message thread not found') || desc.includes('topic not found')) {
      Logger.warn('thread_probe_ping_missing', { threadId, groupId, error: probe.description });
      return false;
    }
    return true;
  } catch (e) {
    Logger.error('thread_probe_ping_error', e, { threadId, groupId });
    return true;
  }
}

async function updateThreadClosedStatus(threadId, closed) {
  if (!threadId) return;
  const key = `thread_closed:${threadId}`;
  if (closed) {
    await KV.put(key, '1', { expirationTtl: 172800 });
    threadHealthCache.set(`thread:${threadId}`, { ok: false, ts: Date.now() });
  } else {
    await safeKvDelete(key);
    threadHealthCache.delete(`thread:${threadId}`);
  }
}

/**
 * 重置用户验证状态并触发重新验证
 * @param {object} options - 选项
 * @param {string} options.userId - 用户 ID
 * @param {string} options.oldThreadId - 旧话题 ID
 * @param {number} options.pendingMsgId - 待处理消息 ID
 * @param {string} options.reason - 原因
 */
async function resetUserVerificationAndRequireReverify({
  userId,
  oldThreadId,
  pendingMsgId,
  reason = 'topic_invalid'
}) {
  try {
    Logger.info('resetting_user_verification', {
      userId,
      oldThreadId,
      reason
    });

    // 删除旧的 thread 映射
    if (oldThreadId) {
      await safeKvDelete(`thread:${oldThreadId}`);
    }

    // 删除用户验证状态
    await safeKvDelete(`verified-${userId}`);
    await safeKvDelete(`user:${userId}`);

    await invalidateCache(`verified-${userId}`);
    memDelete(`user:${userId}`);
    if (oldThreadId) {
      threadHealthCache.delete(`thread:${oldThreadId}`);
    }

    // 通知用户需要重新验证
    const noticeLang = await getUserLang(userId);
    await sendMessage({
      chat_id: userId,
      text: t(noticeLang, 'verification_expired_notice'),
      parse_mode: 'HTML'
    });

    Logger.info('user_verification_reset_complete', { userId, reason });

  } catch (e) {
    Logger.error('reset_verification_failed', e, { userId, reason });
  }
}

// ========== 本地题库验证函数 ==========

// 检查 Turnstile 是否已配置
function hasTurnstileConfigured() {
  const site = getTurnstileSiteKey();
  const secret = getTurnstileSecretKey();
  return !!(site && secret);
}

// 获取当前验证模式
async function getVerifyMode() {
  const mode = await KV.get(KV_KEYS.VERIFY_MODE);
  if (mode === 'turnstile') return hasTurnstileConfigured() ? 'turnstile' : 'local_quiz';
  if (mode === 'both') return hasTurnstileConfigured() ? 'both' : 'local_quiz';
  return 'local_quiz'; // 默认本地题库
}

// 设置验证模式
async function setVerifyMode(mode) {
  if (mode === 'turnstile' && !hasTurnstileConfigured()) return false;
  if (mode === 'both' && !hasTurnstileConfigured()) return false;
  if (!['local_quiz', 'turnstile', 'both'].includes(mode)) return false;
  await KV.put(KV_KEYS.VERIFY_MODE, mode);
  return true;
}

// 获取验证模式显示名称
function getVerifyModeName(mode, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const keys = { 'local_quiz': 'mode_local_quiz', 'turnstile': 'mode_turnstile', 'both': 'mode_both' };
  return keys[mode] ? t(L, keys[mode]) : mode;
}


// 检查本地题库触发频率限制
async function checkLocalQuizTriggerLimit(userId) {
  const key = `quiz_trigger:${userId}`;
  const now = Date.now();
  const windowMs = LOCAL_QUIZ_CONFIG.TRIGGER_WINDOW_SECONDS * 1000;

  let timestamps = [];
  try {
    const data = await KV.get(key);
    if (data) timestamps = JSON.parse(data);
  } catch (e) { /* ignore */ }

  if (!Array.isArray(timestamps)) timestamps = [];

  // 过滤掉过期的记录
  timestamps = timestamps.filter(ts => (now - ts) < windowMs);

  if (timestamps.length >= LOCAL_QUIZ_CONFIG.TRIGGER_LIMIT) {
    return { allowed: false, count: timestamps.length };
  }

  // 添加新记录
  timestamps.push(now);
  await KV.put(key, JSON.stringify(timestamps), {
    expirationTtl: Math.max(LOCAL_QUIZ_CONFIG.TRIGGER_WINDOW_SECONDS * 2, 60)
  });

  return { allowed: true, count: timestamps.length };
}

// 创建新的验证题目
async function createQuizChallenge(userId) {
  // 【安全改进】使用加密安全的随机数
  const questionIndex = secureRandomInt(0, LOCAL_QUIZ_QUESTIONS.length);
  const question = LOCAL_QUIZ_QUESTIONS[questionIndex];

  // 【安全改进】使用加密安全的随机 ID
  const challengeId = `quiz_${Date.now()}_${secureRandomId(9)}`;

  // 存储题目信息到KV
  const challengeData = {
    questionIndex: questionIndex,
    correctAnswer: question.a,
    createdAt: Date.now(),
    attempts: 0
  };

  await KV.put(`quiz_challenge:${userId}`, JSON.stringify(challengeData), {
    expirationTtl: LOCAL_QUIZ_CONFIG.CHALLENGE_TTL_SECONDS
  });

  return { challengeId, question };
}

// 获取当前验证题目（带自愈机制）
async function getQuizChallenge(userId) {
  // 【安全改进】使用 safeGetJSON 防止数据损坏导致崩溃
  const challenge = await safeGetJSON(`quiz_challenge:${userId}`, null);

  // 【自愈机制】检查数据完整性
  if (challenge) {
    const isValid = (
      typeof challenge === 'object' &&
      typeof challenge.questionIndex === 'number' &&
      typeof challenge.correctAnswer === 'number' &&
      typeof challenge.attempts === 'number' &&
      challenge.questionIndex >= 0 &&
      challenge.questionIndex < LOCAL_QUIZ_QUESTIONS.length &&
      challenge.correctAnswer >= 0 &&
      challenge.correctAnswer <= 3
    );

    if (!isValid) {
      Logger.warn('invalid_challenge_data_detected', { userId, challenge });
      // 清理损坏的数据
      await deleteQuizChallenge(userId);
      return null;
    }
  }

  return challenge;
}

// 删除验证题目
async function deleteQuizChallenge(userId) {
  await KV.delete(`quiz_challenge:${userId}`);
}

// ========== 并发验证锁机制 ==========

/**
 * 尝试获取验证锁
 * @param {string} userId - 用户 ID
 * @returns {Promise<{acquired: boolean, lockInfo: object|null}>} 是否成功获取锁
 */
async function tryAcquireVerifyLock(userId) {
  const lockKey = `verify_lock:${userId}`;
  const now = Date.now();

  try {
    // 尝试获取锁
    const lockData = await KV.get(lockKey);

    if (!lockData) {
      // 锁不存在，可以获取
      const newLock = {
        acquiredAt: now,
        expiresAt: now + (CONFIG.VERIFY_LOCK_TTL_SECONDS * 1000)
      };

      await KV.put(lockKey, JSON.stringify(newLock), {
        expirationTtl: CONFIG.VERIFY_LOCK_TTL_SECONDS + 10 // 多给 10 秒缓冲
      });

      Logger.debug('verify_lock_acquired', { userId });
      return { acquired: true, lockInfo: newLock };
    }

    // 锁已存在，检查是否过期
    const lockInfo = JSON.parse(lockData);
    if (lockInfo.expiresAt < now) {
      // 锁已过期，可以重新获取
      const newLock = {
        acquiredAt: now,
        expiresAt: now + (CONFIG.VERIFY_LOCK_TTL_SECONDS * 1000)
      };

      await KV.put(lockKey, JSON.stringify(newLock), {
        expirationTtl: CONFIG.VERIFY_LOCK_TTL_SECONDS + 10
      });

      Logger.debug('verify_lock_reacquired', { userId, expiredAt: lockInfo.expiresAt });
      return { acquired: true, lockInfo: newLock };
    }

    // 锁未过期，拒绝获取
    const remainingMs = lockInfo.expiresAt - now;
    Logger.debug('verify_lock_busy', { userId, remainingMs });
    return { acquired: false, lockInfo: { ...lockInfo, remainingMs } };

  } catch (e) {
    Logger.error('verify_lock_error', e, { userId });
    // 出错时允许继续，避免锁死
    return { acquired: true, lockInfo: null };
  }
}

/**
 * 释放验证锁
 * @param {string} userId - 用户 ID
 */
async function releaseVerifyLock(userId) {
  const lockKey = `verify_lock:${userId}`;
  try {
    await KV.delete(lockKey);
    Logger.debug('verify_lock_released', { userId });
  } catch (e) {
    Logger.error('verify_lock_release_error', e, { userId });
  }
}

// 验证答案
async function verifyQuizAnswer(userId, answerIndex, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const challenge = await getQuizChallenge(userId);
  if (!challenge) {
    return { success: false, reason: 'expired', message: t(L, 'quiz_expired') };
  }
  if (challenge.attempts >= LOCAL_QUIZ_CONFIG.MAX_ATTEMPTS) {
    await deleteQuizChallenge(userId);
    return { success: false, reason: 'max_attempts', message: t(L, 'quiz_max_attempts') };
  }
  challenge.attempts++;
  await KV.put(`quiz_challenge:${userId}`, JSON.stringify(challenge), {
    expirationTtl: LOCAL_QUIZ_CONFIG.CHALLENGE_TTL_SECONDS
  });
  if (answerIndex === challenge.correctAnswer) {
    await deleteQuizChallenge(userId);
    return { success: true };
  }
  const remaining = LOCAL_QUIZ_CONFIG.MAX_ATTEMPTS - challenge.attempts;
  return {
    success: false,
    reason: 'wrong_answer',
    message: t(L, 'quiz_wrong', { remaining }),
    remaining
  };
}


// 生成题目 Inline Keyboard
function generateQuizKeyboard(question, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const opts = (question && question.opts && (question.opts[L] || question.opts.en)) || [];
  const buttons = opts.map((opt, idx) => ({
    text: opt,
    callback_data: `quiz_answer:${idx}`
  }));
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 2) {
    keyboard.push(buttons.slice(i, i + 2));
  }
  return { inline_keyboard: keyboard };
}


// ========== 垃圾消息过滤函数 ==========

// 获取垃圾过滤开关状态
async function getSpamFilterEnabled() {
  const enabled = await KV.get(KV_KEYS.SPAM_FILTER_ENABLED);
  // 默认开启
  return enabled !== '0' && enabled !== 'false';
}

// 设置垃圾过滤开关
async function setSpamFilterEnabled(enabled) {
  await KV.put(KV_KEYS.SPAM_FILTER_ENABLED, enabled ? '1' : '0');
}

// 获取垃圾过滤规则
async function getSpamFilterRules() {
  try {
    const rules = await KV.get(KV_KEYS.SPAM_FILTER_RULES);
    if (!rules) return DEFAULT_SPAM_RULES;
    return JSON.parse(rules);
  } catch (e) {
    return DEFAULT_SPAM_RULES;
  }
}

// 设置垃圾过滤规则
async function setSpamFilterRules(rules) {
  await KV.put(KV_KEYS.SPAM_FILTER_RULES, JSON.stringify(rules));
}

// 重置为默认规则
async function resetSpamFilterRules() {
  await KV.put(KV_KEYS.SPAM_FILTER_RULES, JSON.stringify(DEFAULT_SPAM_RULES));
  return DEFAULT_SPAM_RULES;
}

// 统计文本中的链接数量
function countLinks(text) {
  if (!text) return 0;
  // 匹配 http/https 链接和 t.me 链接
  const linkRegex = /(https?:\/\/[^\s]+|t\.me\/\w+|telegram\.me\/\w+)/gi;
  const matches = text.match(linkRegex);
  return matches ? matches.length : 0;
}

// 检查是否为垃圾消息
async function checkSpam(message, userId = null) {
  // 获取开关状态
  const enabled = await getSpamFilterEnabled();
  if (!enabled) return { isSpam: false, reason: null };

  // 获取规则
  const rules = await getSpamFilterRules();

  // 提取文本内容
  let text = '';
  if (message.text) text = message.text;
  else if (message.caption) text = message.caption;

  if (!text) return { isSpam: false, reason: null };

  const lowerText = text.toLowerCase();

  // 1. 检查放行关键词（白名单优先）
  for (const keyword of rules.allowKeywords || []) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return { isSpam: false, reason: null };
    }
  }

  // 2. 检查放行正则
  for (const regexStr of rules.allowRegexes || []) {
    try {
      const regex = new RegExp(regexStr, 'i');
      if (regex.test(text)) {
        return { isSpam: false, reason: null };
      }
    } catch (e) { /* 忽略无效正则 */ }
  }

  // 3. 检查链接数量
  const linkCount = countLinks(text);
  if (rules.maxLinks > 0 && linkCount >= rules.maxLinks) {
    return { isSpam: true, reasonKey: 'spam_reason_links', reasonVars: { count: linkCount, max: rules.maxLinks }, reason: `Too many links (${linkCount}/${rules.maxLinks})` };
  }

  // 4. 检查关键词
  for (const keyword of rules.keywords || []) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return { isSpam: true, reasonKey: 'spam_reason_keyword', reasonVars: { keyword }, reason: `Blocked keyword: ${keyword}` };
    }
  }

  // 5. 检查正则
  for (const regexStr of rules.regexes || []) {
    try {
      const regex = new RegExp(regexStr, 'i');
      if (regex.test(text)) {
        return { isSpam: true, reasonKey: 'spam_reason_regex', reason: 'Matched a blocked pattern' };
      }
    } catch (e) { /* 忽略无效正则 */ }
  }

  // 6. AI 检测（可选，需要配置 Workers AI）
  const aiResult = await checkSpamWithAI(text, userId);
  if (aiResult.isSpam) {
    return aiResult;
  }

  return { isSpam: false, reason: null };
}

// ========== 垃圾话题管理 ==========

// 获取垃圾话题配置
// Format a spam-check reason in the receiving admin's language.
// checkSpam returns reasonKey/reasonVars; older results may only carry `reason`.
function formatSpamReason(lang, spamCheck) {
  const L = normalizeLang(lang) || getDefaultLang();
  if (spamCheck && spamCheck.reasonKey) return t(L, spamCheck.reasonKey, spamCheck.reasonVars || {});
  if (spamCheck && spamCheck.reason) return spamCheck.reason;
  return '';
}

async function getSpamTopicConfig() {
  return await safeGetJSON(KV_KEYS.SPAM_TOPIC_CONFIG, {
    enabled: CONFIG.SPAM_TOPIC_ENABLED,
    topicId: CONFIG.SPAM_TOPIC_ID,
    autoCreate: false,
    notifyAdmin: true
  });
}

// 设置垃圾话题配置
async function setSpamTopicConfig(config) {
  await KV.put(KV_KEYS.SPAM_TOPIC_CONFIG, JSON.stringify(config));
}

// 检查垃圾话题功能是否启用
async function isSpamTopicEnabled() {
  const config = await getSpamTopicConfig();
  return config.enabled === true;
}

// 创建垃圾话题
async function createSpamTopic(groupId) {
  try {
    // 先尝试获取已有的垃圾话题（通过列出所有话题）
    const listResponse = await requestTelegram('getForumTopicInfo', {
      chat_id: groupId,
      message_thread_id: 1 // 先尝试 General 话题
    });

    // 尝试创建一个新话题
    const response = await requestTelegram('createForumTopic', {
      chat_id: groupId,
      name: t(getDefaultLang(), 'spam_topic_name'),
      icon_color: 0x8E8E8E  // 灰色图标
    });

    if (response && response.ok) {
      const topicId = response.result.message_thread_id;
      Logger.info('spam_topic_created', { groupId, topicId });
      return topicId;
    }

    // 如果创建失败，检查是否是因为话题已存在
    if (response && response.description && response.description.includes('TOPIC_TITLE_IS_EMPTY')) {
      Logger.warn('spam_topic_create_invalid', { groupId, description: response.description });
    }

    if (response && response.description && (response.description.includes('TOPIC_CLOSED') || response.description.includes('TOPIC_NOT_FOUND'))) {
      Logger.error('spam_topic_create_failed', { groupId, description: response.description });
    }

    return null;
  } catch (e) {
    Logger.error('create_spam_topic_failed', e, { groupId });
    return null;
  }
}

// 转发消息到垃圾话题
async function forwardToSpamTopic(message, groupId, topicId) {
  try {
    const result = await forwardMessage({
      chat_id: groupId,
      message_thread_id: topicId,
      from_chat_id: message.chat.id,
      message_id: message.message_id
    });
    if (result.ok && result.result && result.result.message_id) {
      const fwdId = result.result.message_id;
      const userId = message.from ? String(message.from.id) : message.chat.id.toString();
      const kvWrites = [
        KV.put('msg-map-' + fwdId, message.chat.id.toString(), { expirationTtl: 172800 }),
        KV.put('spam-orig-' + fwdId, message.message_id.toString(), { expirationTtl: 172800 }),
      ];
      const threadId = await KV.get(`user:${userId}:topic`);
      if (threadId) {
        kvWrites.push(KV.put('spam-thread-' + fwdId, threadId, { expirationTtl: 172800 }));
      }
      await Promise.all(kvWrites);
    }
    return true;
  } catch (e) {
    Logger.error('forward_to_spam_topic_failed', e, { topicId });
    return false;
  }
}

// 静默转发垃圾消息（用户无感知）
async function silentlyForwardSpamMessage(message, groupId, topicId) {
  try {
    // 转发到垃圾话题
    await forwardToSpamTopic(message, groupId, topicId);

    // 通知到垃圾话题，避免群组模式下打扰管理员私聊
    const silentLang = await getUserLang(ADMIN_UID);
    await sendMessage({
      chat_id: groupId,
      message_thread_id: topicId,
      text: t(silentLang, 'spam_silently_handled', { uid: message.from?.id, topicId }),
      parse_mode: 'HTML'
    });

    return true;
  } catch (e) {
    Logger.error('silently_forward_spam_failed', e);
    return false;
  }
}

// 从垃圾话题恢复消息
async function restoreMessageFromSpamTopic(groupId, spamTopicId, targetTopicId, messageId) {
  try {
    const [guestChatId, origMessageId] = await Promise.all([
      KV.get('msg-map-' + messageId),
      KV.get('spam-orig-' + messageId),
    ]);

    if (!guestChatId) {
      Logger.warn('restore_spam_no_mapping', { messageId });
      return { success: false, reason: 'no_mapping' };
    }

    const isTopicMode = await isTopicForwardingEnabled();
    if (isTopicMode && targetTopicId) {
      const forwardResult = await forwardMessage({
        chat_id: groupId,
        message_thread_id: targetTopicId,
        from_chat_id: groupId,
        message_id: messageId
      });
      if (forwardResult.ok && forwardResult.result && forwardResult.result.message_id) {
        const fwdId = forwardResult.result.message_id;
        await Promise.all([
          KV.put('msg-map-' + fwdId, guestChatId, { expirationTtl: 172800 }),
          KV.put('orig-map-' + (origMessageId || fwdId), fwdId.toString(), { expirationTtl: 172800 }),
          KV.put('fwd-loc-' + fwdId, JSON.stringify({ chat_id: groupId, thread_id: targetTopicId }), { expirationTtl: 172800 }),
        ]);
      }
    } else {
      const copyResult = await copyMessage({
        chat_id: guestChatId,
        from_chat_id: groupId,
        message_id: messageId
      });
      if (copyResult.ok && copyResult.result && copyResult.result.message_id) {
        await KV.put('admin-reply-map-' + messageId, JSON.stringify({
          guestChatId: guestChatId,
          guestMessageId: copyResult.result.message_id
        }), { expirationTtl: 172800 });
      }
    }

    Logger.info('message_restored_from_spam', { groupId, spamTopicId, targetTopicId, messageId, guestChatId });
    return { success: true, guestChatId };
  } catch (e) {
    Logger.error('restore_message_failed', e);
    return { success: false, reason: 'error', error: e };
  }
}

// ========== 用户话题管理 ==========
async function ensureUserTopic(userId, profile = null) {
  const inFlightKey = String(userId);
  const inFlight = topicCreateInFlight.get(inFlightKey);
  if (inFlight) return inFlight;

  const promise = ensureUserTopicInternal(userId, profile);
  topicCreateInFlight.set(inFlightKey, promise);
  try {
    return await promise;
  } finally {
    if (topicCreateInFlight.get(inFlightKey) === promise) {
      topicCreateInFlight.delete(inFlightKey);
    }
  }
}

async function ensureUserTopicInternal(userId, profile = null) {
  if (!GROUP_ID) {
    Logger.warn('ensure_user_topic_no_group_id', { userId });
    return null;
  }

  // 尝试验证环境，但即使验证失败也尝试继续
  const topicEnv = await verifyTopicEnvironment({ notifyOnFailure: false });
  Logger.info('ensure_user_topic_env_check', { userId, topicEnv });

  const userKey = `user:${userId}`;
  let userData = await safeGetJSON(userKey, null);

  if (userData && userData.thread_id) {
    const healthy = await validateForumThread(GROUP_ID, userData.thread_id);
    Logger.info('ensure_user_topic_thread_health', { userId, threadId: userData.thread_id, healthy });
    if (healthy) {
      return { threadId: userData.thread_id, userData, newlyCreated: false };
    }

    try {
      await safeKvDelete(`thread:${userData.thread_id}`);
    } catch (e) {
      Logger.warn('cleanup_stale_thread_failed', e, { threadId: userData.thread_id });
    }
  }

  const lockToken = await acquireTopicLock(userId);
  if (!lockToken) {
    Logger.warn('topic_lock_acquire_failed', { userId });
  }

  try {
    userData = await safeGetJSON(userKey, null);
    if (userData && userData.thread_id) {
      const healthy = await validateForumThread(GROUP_ID, userData.thread_id);
      if (healthy) {
        return { threadId: userData.thread_id, userData, newlyCreated: false };
      }
      try {
        await safeKvDelete(`thread:${userData.thread_id}`);
      } catch (e) {
        Logger.warn('cleanup_stale_thread_failed', e, { threadId: userData.thread_id });
      }
    }

    if (!profile) {
      profile = await getUserProfile(userId);
    }

    Logger.info('ensure_user_topic_creating_thread', { userId });
    const threadId = await createUserTopicThread(userId, profile);
    Logger.info('ensure_user_topic_thread_created', { userId, threadId });
    if (!threadId) {
      return null;
    }

    const record = {
      user_id: userId,
      thread_id: threadId,
      username: profile?.username || null,
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      updated_at: Date.now()
    };

    await safeKvPut(userKey, JSON.stringify(record));
    await safeKvPut(`thread:${threadId}`, userId);
    threadHealthCache.set(`thread:${threadId}`, { ok: true, ts: Date.now() });

    return { threadId, userData: record, newlyCreated: true };
  } finally {
    await releaseTopicLock(userId, lockToken);
  }
}

async function invalidateUserTopicMapping(userId, threadId = null) {
  try {
    if (threadId) {
      await safeKvDelete(`thread:${threadId}`);
      threadHealthCache.delete(`thread:${threadId}`);
      try {
        await KV.delete(`thread_ok:${threadId}`);
      } catch (e) {
        Logger.warn('thread_ok_delete_failed', e, { threadId });
      }
    }
    await safeKvDelete(`user:${userId}`);
    memDelete(`user:${userId}`);
  } catch (e) {
    Logger.warn('invalidate_user_topic_failed', e, { userId, threadId });
  }

  if (ADMIN_UID) {
    const noticeKey = `topic_recover:${userId}`;
    const lastNotice = memGet(noticeKey);
    if (!lastNotice) {
      const recoverLang = await getUserLang(ADMIN_UID);
      await sendMessage({
        chat_id: ADMIN_UID,
        text: t(recoverLang, 'topic_recover_notice', { userId })
      }).catch(() => { });
      memSet(noticeKey, Date.now(), 5 * 60 * 1000);
    }
  }
}

async function createUserTopicThread(userId, profile = null) {
  if (!GROUP_ID) {
    Logger.error('create_user_topic_no_group_id', { userId });
    return null;
  }

  const groupIdStr = String(GROUP_ID);
  Logger.info('create_user_topic_group_id_check', { userId, GROUP_ID, startsWithMinus100: groupIdStr.startsWith('-100') });

  if (!groupIdStr.startsWith('-100')) {
    Logger.error('create_user_topic_invalid_group_id', {
      userId,
      GROUP_ID,
      hint: 'Group ID must start with -100. Please use a supergroup.'
    });
  }

  const topicTitle = buildUserTopicTitle(userId, profile);
  Logger.info('create_user_topic_starting', { userId, topicTitle });

  try {
    const response = await requestTelegram('createForumTopic', {
      chat_id: GROUP_ID,
      name: topicTitle
    });

    Logger.info('create_user_topic_response', { userId, ok: response?.ok, description: response?.description });

    if (!response || !response.ok) {
      Logger.error('create_user_topic_failed', {
        userId,
        description: response?.description
      });
      return null;
    }

    const threadId = response.result.message_thread_id;
    Logger.info('create_user_topic_got_thread_id', { userId, threadId });

    try {
      await sendTopicWelcomeMessage(threadId, userId, profile);
    } catch (welcomeErr) {
      Logger.warn('send_topic_welcome_failed', welcomeErr, { userId, threadId });
    }

    Logger.info('user_topic_created', { userId, threadId, topicTitle });
    return threadId;
  } catch (e) {
    Logger.error('create_user_topic_error', e, { userId });
    return null;
  }
}

async function acquireTopicLock(userId) {
  const lockKey = `topic_lock:${userId}`;
  const token = secureRandomId(16);
  for (let attempt = 0; attempt < 5; attempt++) {
    await KV.put(lockKey, token, { expirationTtl: 60 });
    const stored = await KV.get(lockKey);
    if (stored === token) {
      return token;
    }
    await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
  }
  return null;
}

async function releaseTopicLock(userId, token) {
  if (!token) return;
  const lockKey = `topic_lock:${userId}`;
  try {
    const stored = await KV.get(lockKey);
    if (stored === token) {
      await KV.delete(lockKey);
    }
  } catch (e) {
    Logger.warn('release_topic_lock_failed', e, { userId });
  }
}

function buildUserTopicTitle(userId, profile = null) {
  let displayName = '';
  if (profile) {
    displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  }
  if (!displayName) displayName = t(getDefaultLang(), 'guest_default_name');

  let title = `${displayName}（${userId}）`;
  if (title.length > 60) {
    title = title.slice(0, 60);
  }
  return title;
}

// ========== 新用户通知 / 屏蔽通知 ==========

// 验证方式暂存：验证成功路径在处理暂存消息之前写入，话题欢迎卡消费它。
// 这样无论话题是验证流程创建的、还是暂存消息转发时抢先创建的，卡片都带验证方式且只发一次。
const pendingVerifyMethod = new Map(); // userId -> { method, ts }

function markPendingVerifyMethod(userId, method) {
  pendingVerifyMethod.set(String(userId), { method, ts: Date.now() });
}

function consumePendingVerifyMethod(userId) {
  const key = String(userId);
  const entry = pendingVerifyMethod.get(key);
  if (!entry) return null;
  pendingVerifyMethod.delete(key);
  if (Date.now() - entry.ts > 10 * 60 * 1000) return null;
  return entry.method;
}

async function isNewUserNotified(userId) {
  try {
    return !!(await KV.get(`newuser_notified:${userId}`));
  } catch (e) {
    return false;
  }
}

async function claimNewUserNotified(userId) {
  try {
    await KV.put(`newuser_notified:${userId}`, '1', { expirationTtl: VERIFICATION_TTL });
  } catch (e) { /* 去重标记失败不阻断通知 */ }
}

function newUserMethodLabel(lang, method) {
  if (method === 'turnstile') return t(lang, 'new_user_method_turnstile');
  if (method === 'both') return t(lang, 'new_user_method_both');
  return t(lang, 'new_user_method_quiz');
}

function buildProfileLines(lang, userId, profile) {
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
    || profile?.username || String(userId);
  const lines = [
    t(lang, 'new_user_name', { name: escapeHtml(displayName) }),
    t(lang, 'new_user_uid', { uid: userId })
  ];
  if (profile?.username) {
    lines.push(t(lang, 'new_user_username', { username: escapeHtml(profile.username) }));
  } else {
    lines.push(t(lang, 'new_user_no_username'));
  }
  return lines;
}

// 新用户接入卡（RelayGo 风格）：资料 + 验证方式 + 资料/信任/封禁按钮
function buildNewUserCard(lang, userId, profile, method, { inTopic = false } = {}) {
  const lines = [
    t(lang, 'new_user_title'),
    '',
    ...buildProfileLines(lang, userId, profile)
  ];
  if (method) {
    lines.push(t(lang, 'new_user_method', { method: newUserMethodLabel(lang, method) }));
  }
  lines.push('', t(lang, 'new_user_hint'));
  if (inTopic) {
    lines.push(t(lang, 'topic_welcome_hint'));
  }
  return {
    text: lines.join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: t(lang, 'btn_open_profile'), url: `tg://user?id=${userId}` }],
        [
          { text: t(lang, 'btn_trust_user'), callback_data: `newuser_trust:${userId}` },
          { text: t(lang, 'btn_ban_user'), callback_data: `newuser_ban:${userId}` }
        ]
      ]
    }
  };
}

function buildBlockedBotCard(lang, userId, profile) {
  const lines = [
    t(lang, 'blocked_bot_title'),
    '',
    ...buildProfileLines(lang, userId, profile),
    '',
    t(lang, 'blocked_bot_note')
  ];
  return lines.join('\n');
}

/**
 * 新用户完成验证后的通知（去重：每个用户每 VERIFICATION_TTL 周期只通知一次）。
 * 路由：话题模式 → 立即确保该用户话题存在，卡片发进话题（话题刚创建时由
 * sendTopicWelcomeMessage 以同一张卡充当欢迎消息，并认领去重标记，本函数不会重复发）；
 * 私聊模式 → 私发每位管理员（各自的语言）。
 */
async function notifyNewUserVerified(userId, profile, method) {
  const uid = String(userId);
  try {
    if (await isNewUserNotified(uid)) {
      Logger.debug('new_user_notify_deduped', { userId: uid });
      return;
    }

    markPendingVerifyMethod(uid, method);

    const topicMode = await isTopicForwardingEnabled();
    if (topicMode && GROUP_ID) {
      const ctx = await ensureUserTopic(uid, profile);
      if (ctx && ctx.threadId) {
        // 话题刚创建时欢迎卡已发出并认领去重标记 → 不重复发送
        if (await isNewUserNotified(uid)) return;
        // 话题早已存在（或欢迎卡未发出）→ 把卡片补发进该话题
        const lang = await getUserLang(ADMIN_UID);
        const card = buildNewUserCard(lang, uid, profile, method, { inTopic: true });
        await sendMessage({
          chat_id: GROUP_ID,
          message_thread_id: ctx.threadId,
          text: card.text,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: card.reply_markup
        });
        await claimNewUserNotified(uid);
        return;
      }
      // 话题创建失败 → 回退到私聊通知
      Logger.warn('new_user_notify_topic_fallback_dm', { userId: uid });
    }

    await claimNewUserNotified(uid);
    await Promise.all(ADMIN_ID_LIST.map(async adminId => {
      const adminLang = await getUserLang(adminId);
      const card = buildNewUserCard(adminLang, uid, profile, method);
      return sendMessage({
        chat_id: adminId,
        text: card.text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: card.reply_markup
      }).catch(() => { });
    }));
  } catch (e) {
    Logger.error('notify_new_user_failed', e, { userId: uid });
  }
}

/**
 * 处理 my_chat_member 更新：仅私聊场景（访客与机器人的一对一会话）。
 * 访客屏蔽机器人（member → kicked）→ 通知管理员（去重，bot_blocked:<uid> 标记）；
 * 取消屏蔽（kicked → member）→ 静默清除标记。群组内的成员变动与本功能无关，全部忽略。
 */
async function handleMyChatMember(myChatMember) {
  try {
    const chat = myChatMember?.chat;
    const from = myChatMember?.from;
    if (!chat || chat.type !== 'private' || !from) return;

    const userId = String(from.id);
    if (String(chat.id) !== userId) return; // 只处理访客本人的一对一会话
    if (isAdmin(userId)) return;

    const oldStatus = myChatMember.old_chat_member?.status;
    const newStatus = myChatMember.new_chat_member?.status;

    if (newStatus === 'member' && oldStatus === 'kicked') {
      await KV.delete(`bot_blocked:${userId}`).catch(() => { });
      Logger.info('bot_unblocked_by_user', { userId });
      return;
    }

    if (newStatus !== 'kicked' || oldStatus === 'kicked') return;

    const already = await KV.get(`bot_blocked:${userId}`);
    if (already) return; // 已通知过，去重
    await KV.put(`bot_blocked:${userId}`, String(Date.now()));

    const profile = (await getUserProfile(userId)) || from;
    Logger.info('bot_blocked_by_user', { userId });

    // 路由：话题模式且该用户话题已存在 → 发进话题（不新建话题）；否则私发管理员
    const topicMode = await isTopicForwardingEnabled();
    let postedToTopic = false;
    if (topicMode && GROUP_ID) {
      const userData = await safeGetJSON(`user:${userId}`, null);
      if (userData && userData.thread_id) {
        const lang = await getUserLang(ADMIN_UID);
        await sendMessage({
          chat_id: GROUP_ID,
          message_thread_id: userData.thread_id,
          text: buildBlockedBotCard(lang, userId, profile),
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true }
        }).catch(() => { });
        postedToTopic = true;
      }
    }

    if (!postedToTopic) {
      await Promise.all(ADMIN_ID_LIST.map(async adminId => {
        const adminLang = await getUserLang(adminId);
        return sendMessage({
          chat_id: adminId,
          text: buildBlockedBotCard(adminLang, userId, profile),
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true }
        }).catch(() => { });
      }));
    }
  } catch (e) {
    Logger.error('handle_my_chat_member_failed', e);
  }
}

async function sendTopicWelcomeMessage(threadId, userId, profile = null) {
  if (!GROUP_ID) return;
  try {
    const lang = await getUserLang(ADMIN_UID);
    // 若该话题是验证流程触发创建的，欢迎消息就是新用户接入卡（带验证方式）；
    // 消费掉暂存的验证方式并认领去重标记，notifyNewUserVerified 不会重复发送。
    const method = consumePendingVerifyMethod(userId);
    const card = buildNewUserCard(lang, userId, profile, method, { inTopic: true });
    await sendMessage({
      chat_id: GROUP_ID,
      message_thread_id: threadId,
      text: card.text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: card.reply_markup
    });
    if (method) {
      await claimNewUserNotified(userId);
    }
  } catch (e) {
    Logger.warn('topic_welcome_message_failed', e, { userId, threadId });
  }
}


// ========== Workers AI 垃圾检测 ==========

// 检查 AI 检测是否启用
async function isAISpamDetectionEnabled() {
  const config = await safeGetJSON(KV_KEYS.AI_SPAM_DETECTION, {
    enabled: CONFIG.AI_SPAM_DETECTION_ENABLED,
    confidenceThreshold: CONFIG.AI_CONFIDENCE_THRESHOLD
  });
  return config.enabled === true;
}

// 设置 AI 检测配置
async function setAISpamDetectionConfig(config) {
  await KV.put(KV_KEYS.AI_SPAM_DETECTION, JSON.stringify(config));
}

// 获取 AI 检测配置
async function getAISpamDetectionConfig() {
  return await safeGetJSON(KV_KEYS.AI_SPAM_DETECTION, {
    enabled: CONFIG.AI_SPAM_DETECTION_ENABLED,
    confidenceThreshold: CONFIG.AI_CONFIDENCE_THRESHOLD
  });
}

// 检查 AI 使用速率限制
async function checkAIRateLimit() {
  const now = Date.now();
  const hourKey = `${KV_KEYS.AI_USAGE_COUNT}${Math.floor(now / 3600000)}`;

  const count = await KV.get(hourKey);
  const currentCount = count ? parseInt(count) : 0;

  if (currentCount >= CONFIG.AI_RATE_LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0, resetAfter: 3600 - Math.floor((now % 3600000) / 1000) };
  }

  return { allowed: true, remaining: CONFIG.AI_RATE_LIMIT_PER_HOUR - currentCount };
}

// 增加 AI 使用计数
async function incrementAIUsage() {
  const now = Date.now();
  const hourKey = `${KV_KEYS.AI_USAGE_COUNT}${Math.floor(now / 3600000)}`;
  const currentCount = await KV.get(hourKey);
  const newCount = (currentCount ? parseInt(currentCount) : 0) + 1;

  await KV.put(hourKey, String(newCount), { expirationTtl: 7200 });
}

// 使用 Workers AI 检测垃圾消息
async function checkSpamWithAI(text, userId = null) {
  // 检查 AI 是否启用
  const aiEnabled = await isAISpamDetectionEnabled();
  if (!aiEnabled) {
    return { isSpam: false, reason: null, aiSkipped: true };
  }

  // 检查速率限制
  const rateLimit = await checkAIRateLimit();
  if (!rateLimit.allowed) {
    Logger.warn('ai_rate_limit_exceeded', { userId, remainingReset: rateLimit.resetAfter });
    return { isSpam: false, reason: null, aiSkipped: true, rateLimited: true };
  }

  // 检查文本长度（太短不需要 AI 检测）
  if (text.length < 20) {
    return { isSpam: false, reason: null, aiSkipped: true, tooShort: true };
  }

  try {
    // 构建 AI 提示词
    const prompt = `请判断以下消息是否为垃圾广告消息。只回答"spam"或"not_spam"。
    
消息内容：
${text}

判断标准：
- 包含推广、营销、投资、理财、博彩等内容 → spam
- 包含多个链接或联系方式 → spam
- 正常交流、提问、聊天 → not_spam

你的回答（只回答 spam 或 not_spam）：`;

    // 调用 Workers AI
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${getEnv('CF_ACCOUNT_ID')}/ai/run/${CONFIG.AI_MODEL_ID}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getEnv('CF_AI_TOKEN')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 10,
          temperature: 0.1
        })
      }
    );

    if (!response.ok) {
      Logger.error('ai_api_call_failed', { status: response.status });
      return { isSpam: false, reason: null, aiSkipped: true, apiError: true };
    }

    const result = await response.json();
    const aiResponse = result.result?.response?.trim().toLowerCase() || '';

    // 增加使用计数
    await incrementAIUsage();

    // 判断结果
    const isSpam = aiResponse.includes('spam') && !aiResponse.includes('not_spam');

    if (isSpam) {
      Logger.info('ai_detected_spam', { userId, text: text.substring(0, 50) });
      return {
        isSpam: true,
        reasonKey: 'spam_reason_ai',
        reason: 'Flagged as spam by AI',
        aiConfidence: 0.8,
        aiResponse
      };
    }

    return { isSpam: false, reason: null, aiChecked: true };

  } catch (e) {
    Logger.error('ai_detection_failed', e, { userId });
    return { isSpam: false, reason: null, aiSkipped: true, error: true };
  }
}

// 格式化规则为可读文本
function formatSpamRules(rules, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const lines = [];
  lines.push(t(L, 'rules_link_limit', { max: rules.maxLinks }));
  if (rules.keywords && rules.keywords.length > 0) {
    lines.push(`\n${t(L, 'rules_block_keywords', { count: rules.keywords.length })}`);
    lines.push(rules.keywords.slice(0, 10).join(', '));
    if (rules.keywords.length > 10) {
      lines.push(t(L, 'rules_more', { count: rules.keywords.length }));
    }
  }
  if (rules.regexes && rules.regexes.length > 0) {
    lines.push(`\n${t(L, 'rules_block_regex', { count: rules.regexes.length })}`);
    rules.regexes.slice(0, 3).forEach(r => lines.push(`• ${r}`));
    if (rules.regexes.length > 3) {
      lines.push(t(L, 'rules_more', { count: rules.regexes.length }));
    }
  }
  if (rules.allowKeywords && rules.allowKeywords.length > 0) {
    lines.push(`\n${t(L, 'rules_allow_keywords', { keywords: rules.allowKeywords.join(', ') })}`);
  }
  return lines.join('\n');
}


// 解析规则编辑文本
function parseSpamRulesEdit(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rules = {
    maxLinks: DEFAULT_SPAM_RULES.maxLinks,
    keywords: [...DEFAULT_SPAM_RULES.keywords],
    regexes: [...DEFAULT_SPAM_RULES.regexes],
    allowKeywords: [],
    allowRegexes: []
  };

  let clearDefaults = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // 清空默认规则指令
    if (lower === '清空默认' || lower === 'clear defaults' || lower === 'clear') {
      clearDefaults = true;
      rules.keywords = [];
      rules.regexes = [];
      continue;
    }

    // 链接数量限制: max_links=N
    const maxLinksMatch = line.match(/max_links[=:](\d+)/i);
    if (maxLinksMatch) {
      rules.maxLinks = parseInt(maxLinksMatch[1]) || 0;
      continue;
    }

    // 放行关键词: allow:关键词1,关键词2
    if (lower.startsWith('allow:') || lower.startsWith('放行:')) {
      const content = line.split(/[:：]/, 2)[1] || '';
      const keywords = content.split(/[,，、]/).map(k => k.trim()).filter(Boolean);
      rules.allowKeywords.push(...keywords);
      continue;
    }

    // 拦截关键词: block:关键词1,关键词2
    if (lower.startsWith('block:') || lower.startsWith('拦截:') || lower.startsWith('屏蔽:')) {
      const content = line.split(/[:：]/, 2)[1] || '';
      const keywords = content.split(/[,，、]/).map(k => k.trim()).filter(Boolean);
      if (clearDefaults) {
        rules.keywords = keywords;
      } else {
        rules.keywords.push(...keywords);
      }
      continue;
    }

    // 放行正则: allow_re:正则
    if (lower.startsWith('allow_re:') || lower.startsWith('allow_regex:') || lower.startsWith('放行正则:')) {
      const content = line.split(/[:：]/, 2)[1] || '';
      if (content) rules.allowRegexes.push(content);
      continue;
    }

    // 拦截正则: block_re:正则
    if (lower.startsWith('block_re:') || lower.startsWith('block_regex:') || lower.startsWith('拦截正则:')) {
      const content = line.split(/[:：]/, 2)[1] || '';
      if (content) {
        if (clearDefaults) {
          rules.regexes = [content];
        } else {
          rules.regexes.push(content);
        }
      }
      continue;
    }

    // 裸行：作为关键词处理
    const keywords = line.split(/[,，、]/).map(k => k.trim()).filter(Boolean);
    if (clearDefaults) {
      rules.keywords = [...new Set([...rules.keywords, ...keywords])];
    } else {
      rules.keywords = [...new Set([...rules.keywords, ...keywords])];
    }
  }

  // 去重
  rules.keywords = [...new Set(rules.keywords)];
  rules.regexes = [...new Set(rules.regexes)];
  rules.allowKeywords = [...new Set(rules.allowKeywords)];
  rules.allowRegexes = [...new Set(rules.allowRegexes)];

  return rules;
}

// ========== 多级缓存系统优化 ==========

// L1 缓存：内存缓存（最快，进程内）
const memCache = new Map();
const MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 分钟
const BOT_SELF_CACHE_KEY = 'bot:self_profile';
const BOT_SELF_CACHE_TTL_MS = 10 * 60 * 1000;
const TOPIC_ENV_CACHE_KEY = 'topic_env_status';
const TOPIC_ENV_CACHE_TTL_MS = 5 * 60 * 1000;
const TOPIC_ENV_ALERT_CACHE_KEY = 'topic_env_alert';
const TOPIC_ENV_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

// L2 缓存：Cache API（免费、冷启动友好、同 PoP 内跨 isolate 共享）
const CACHE_API_BASE_URL = 'https://cache.saferelay.internal';

async function cacheApiGet(key) {
  try {
    const cache = caches.default;
    if (!cache) return undefined;
    const url = new URL(`/__cache/${encodeURIComponent(key)}`, CACHE_API_BASE_URL);
    const resp = await cache.match(url);
    if (!resp) {
      cacheStats.cacheApiMisses++;
      return undefined;
    }
    const ageHeader = resp.headers.get('age');
    const maxAge = parseInt(resp.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || '0', 10);
    if (maxAge > 0 && ageHeader && parseInt(ageHeader, 10) > maxAge) {
      await cache.delete(url);
      cacheStats.cacheApiMisses++;
      return undefined;
    }
    cacheStats.cacheApiHits++;
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (e) {
    cacheStats.cacheApiMisses++;
    return undefined;
  }
}

async function cacheApiSet(key, value, ttlSeconds) {
  try {
    const cache = caches.default;
    if (!cache) return;
    const url = new URL(`/__cache/${encodeURIComponent(key)}`, CACHE_API_BASE_URL);
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    const resp = new Response(body, {
      headers: {
        'Cache-Control': `public, max-age=${ttlSeconds}`,
        'Content-Type': 'application/json',
      },
    });
    await cache.put(url, resp);
  } catch (e) {
    // Cache API 不可用时静默降级
  }
}

async function cacheApiDelete(key) {
  try {
    const cache = caches.default;
    if (!cache) return;
    const url = new URL(`/__cache/${encodeURIComponent(key)}`, CACHE_API_BASE_URL);
    await cache.delete(url);
  } catch (e) {
    // 静默降级
  }
}

// L3 缓存：KV 缓存（最慢，持久化，消耗配额）
const KV_CACHE_TTL = 60 * 60; // 1 小时

// 缓存统计
const cacheStats = {
  hits: 0,
  misses: 0,
  kvHits: 0,
  kvMisses: 0,
  cacheApiHits: 0,
  cacheApiMisses: 0
};

/**
 * L1 缓存获取
 * @param {string} key - 缓存键
 * @returns {any} 缓存值
 */
function memGet(key) {
  const item = memCache.get(key);
  if (!item) {
    cacheStats.misses++;
    return undefined;
  }
  if (Date.now() > item.expiry) {
    memCache.delete(key);
    cacheStats.misses++;
    return undefined;
  }
  cacheStats.hits++;
  return item.value;
}

/**
 * L1 缓存设置
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {number} ttlMs - 过期时间（毫秒）
 */
function memSet(key, value, ttlMs = MEMORY_CACHE_TTL) {
  memCache.set(key, { value, expiry: Date.now() + ttlMs });

  // 当缓存过大时，清理最旧的 20% 条目
  if (memCache.size > 2000) {
    const entriesToDelete = Math.floor(memCache.size * 0.2);
    const entries = Array.from(memCache.entries());
    // 按过期时间排序，删除最早过期的
    entries.sort((a, b) => a[1].expiry - b[1].expiry);
    for (let i = 0; i < entriesToDelete; i++) {
      memCache.delete(entries[i][0]);
    }
  }
}

/**
 * L1 缓存删除
 * @param {string} key - 缓存键
 */
function memDelete(key) {
  memCache.delete(key);
}

/**
 * L3 缓存获取（KV 持久化，消耗配额）
 * @param {string} key - 缓存键
 * @param {any} defaultValue - 默认值
 * @returns {Promise<any>} 缓存值
 */
async function kvCacheGet(key, defaultValue = null) {
  try {
    const cached = await KV.get(key);
    if (cached) {
      cacheStats.kvHits++;
      return JSON.parse(cached);
    }
    cacheStats.kvMisses++;
    return defaultValue;
  } catch (e) {
    Logger.debug('kv_cache_get_error', e, { key });
    return defaultValue;
  }
}

/**
 * L3 缓存设置（KV 持久化，消耗配额）
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {number} ttlSeconds - 过期时间（秒）
 */
async function kvCacheSet(key, value, ttlSeconds = KV_CACHE_TTL) {
  try {
    await KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (e) {
    Logger.debug('kv_cache_set_error', e, { key });
  }
}

/**
 * 三级缓存获取（L1 内存 → L2 Cache API → L3 KV）
 * Cache API 免费、冷启动友好、同 PoP 跨 isolate 共享，
 * 作为内存与 KV 之间的快速能力层，大幅减少冷启动时的 KV 读取。
 * @param {string} key - 缓存键
 * @param {Function} fetchFn - 获取数据的异步函数
 * @param {number} l1Ttl - L1 缓存 TTL（毫秒）
 * @param {number} l2Ttl - L2 Cache API TTL（秒）
 * @param {number} l3Ttl - L3 KV TTL（秒）
 * @returns {Promise<any>} 缓存值
 */
async function multiLevelCacheGet(key, fetchFn, l1Ttl = MEMORY_CACHE_TTL, l2Ttl = KV_CACHE_TTL, l3Ttl = KV_CACHE_TTL) {
  let value = memGet(key);
  if (value !== undefined) {
    return value;
  }

  value = await cacheApiGet(key);
  if (value !== undefined) {
    memSet(key, value, l1Ttl);
    return value;
  }

  value = await kvCacheGet(key);
  if (value !== null) {
    memSet(key, value, l1Ttl);
    await cacheApiSet(key, value, l2Ttl);
    return value;
  }

  value = await fetchFn();

  memSet(key, value, l1Ttl);
  await cacheApiSet(key, value, l2Ttl);
  await kvCacheSet(key, value, l3Ttl);

  return value;
}

/**
 * 冷启动友好的热路径缓存读取（L1 → L2 Cache API，不读 KV）
 * 适用于高频但可容忍短暂不一致的数据（白名单、黑名单、验证状态等），
 * 冷启动时 Cache API 仍可命中，避免 KV 读取消耗配额。
 * @param {string} key - 缓存键
 * @param {Function} fetchFn - 回源函数（仅在 L1/L2 均未命中时调用）
 * @param {number} l1Ttl - L1 TTL（毫秒）
 * @param {number} l2Ttl - L2 Cache API TTL（秒）
 * @returns {Promise<any>} 缓存值
 */
async function hotCacheGet(key, fetchFn, l1Ttl = 30 * 1000, l2Ttl = 120) {
  let value = memGet(key);
  if (value !== undefined) {
    return value;
  }

  value = await cacheApiGet(key);
  if (value !== undefined) {
    memSet(key, value, l1Ttl);
    return value;
  }

  value = await fetchFn();

  memSet(key, value, l1Ttl);
  await cacheApiSet(key, value, l2Ttl);

  return value;
}

/**
 * 失效所有缓存层（L1 + L2 Cache API + 可选 L3 KV）
 * @param {string} key - 缓存键
 * @param {boolean} invalidateKv - 是否同时失效 KV（默认 false，KV 由写入方保证一致性）
 */
async function invalidateCache(key, invalidateKv = false) {
  memDelete(key);
  await cacheApiDelete(key);
  if (invalidateKv) {
    try { await KV.delete(key); } catch (e) { /* 静默 */ }
  }
}

/**
 * 获取缓存统计信息
 * @returns {object} 缓存统计
 */
function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(2) : 0;
  const cacheApiTotal = cacheStats.cacheApiHits + cacheStats.cacheApiMisses;
  const cacheApiHitRate = cacheApiTotal > 0 ? ((cacheStats.cacheApiHits / cacheApiTotal) * 100).toFixed(2) : 0;
  const kvTotal = cacheStats.kvHits + cacheStats.kvMisses;
  const kvHitRate = kvTotal > 0 ? ((cacheStats.kvHits / kvTotal) * 100).toFixed(2) : 0;

  return {
    l1: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: hitRate + '%',
      size: memCache.size
    },
    l2: {
      hits: cacheStats.cacheApiHits,
      misses: cacheStats.cacheApiMisses,
      hitRate: cacheApiHitRate + '%'
    },
    l3: {
      hits: cacheStats.kvHits,
      misses: cacheStats.kvMisses,
      hitRate: kvHitRate + '%'
    }
  };
}

/**
 * 清空所有缓存
 */
function clearAllCache() {
  memCache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.cacheApiHits = 0;
  cacheStats.cacheApiMisses = 0;
  cacheStats.kvHits = 0;
  cacheStats.kvMisses = 0;
}

// ========== KV 配额熔断保护 ==========
// 【优化】使用内存变量作为熔断器状态，避免在 KV 配额耗尽时无法读写熔断标记
let _kvQuotaBreakerUntil = 0;       // 熔断到期时间戳（ms）
let _kvQuotaLastNoticeAt = 0;       // 上一次通知时间戳（ms），用于通知冷却

// 检查是否为 KV 配额错误
function isKvQuotaError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  const status = err.status || 0;

  return status === 429 ||
    msg.includes("kv put failed: 429") ||
    msg.includes("kv get failed: 429") ||
    msg.includes("kv list failed: 429") ||
    (msg.includes("429") && (msg.includes("too many requests") || msg.includes("rate") || msg.includes("quota") || msg.includes("limit")));
}

// 触发熔断器（仅写内存，避免再次调用 KV）
function tripKvQuotaBreaker() {
  _kvQuotaBreakerUntil = Date.now() + (CONFIG.KV_QUOTA_BREAKER_TTL * 1000);
  Logger.warn('kv_quota_breaker_tripped', { ttl: CONFIG.KV_QUOTA_BREAKER_TTL });
}

// 检查熔断器是否触发（纯内存读取）
function isKvQuotaBreakerTripped() {
  return Date.now() < _kvQuotaBreakerUntil;
}

// 检查是否应该发送 KV 配额超限通知（基于内存冷却，避免再次调用 KV）
function shouldSendKvQuotaNotice() {
  const now = Date.now();
  if (now - _kvQuotaLastNoticeAt < CONFIG.KV_QUOTA_NOTICE_COOLDOWN * 1000) {
    return false;
  }
  _kvQuotaLastNoticeAt = now;
  return true;
}

// 发送 KV 配额超限通知
async function sendKvQuotaExceededNotice() {
  if (!shouldSendKvQuotaNotice()) return;
  try {
    await sendMessage({
      chat_id: ADMIN_UID,
      text: t(await getUserLang(ADMIN_UID), 'kv_quota_notice'),
      parse_mode: 'HTML'
    });
  } catch (e) {
    Logger.error('kv_quota_notice_send_failed', e);
  }
}

// 安全的 KV 操作包装（带熔断保护）
async function safeKvGet(key) {
  if (isKvQuotaBreakerTripped()) {
    throw new Error('KV quota breaker is tripped');
  }
  try {
    return await KV.get(key);
  } catch (e) {
    if (isKvQuotaError(e)) {
      tripKvQuotaBreaker();
      // 注意：sendKvQuotaExceededNotice 内部调用 sendMessage（Telegram API），不会再触发 KV
      sendKvQuotaExceededNotice().catch(err => Logger.error('kv_quota_notice_failed', err));
    }
    throw e;
  }
}

async function safeKvPut(key, value, options = {}) {
  if (isKvQuotaBreakerTripped()) {
    throw new Error('KV quota breaker is tripped');
  }
  try {
    return await KV.put(key, value, options);
  } catch (e) {
    if (isKvQuotaError(e)) {
      tripKvQuotaBreaker();
      sendKvQuotaExceededNotice().catch(err => Logger.error('kv_quota_notice_failed', err));
    }
    throw e;
  }
}

async function safeKvDelete(key) {
  if (isKvQuotaBreakerTripped()) {
    throw new Error('KV quota breaker is tripped');
  }
  try {
    return await KV.delete(key);
  } catch (e) {
    if (isKvQuotaError(e)) {
      tripKvQuotaBreaker();
      sendKvQuotaExceededNotice().catch(err => Logger.error('kv_quota_notice_failed', err));
    }
    throw e;
  }
}

// ========== 消息暂存队列 ==========

// 获取暂存队列 key
function pendingQueueKey(userId) {
  return `pending_queue:${userId}`;
}

function pendingMessageKey(userId, messageId) {
  return `pending_msg:${userId}:${messageId}`;
}

function buildPendingMessageSnapshot(message, userId) {
  return {
    chat: { id: userId },
    message_id: message.message_id,
    text: message.text || '',
    caption: message.caption || ''
  };
}

// 获取用户的暂存消息队列
async function getPendingQueue(userId) {
  try {
    const data = await KV.get(pendingQueueKey(userId));
    if (!data) return [];
    const arr = JSON.parse(data);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    Logger.error('get_pending_queue_failed', e, { userId });
    return [];
  }
}

// 添加消息到暂存队列（带去重）
async function appendPendingQueue(userId, message) {
  const messageId = typeof message === 'object' ? message.message_id : message;
  const mid = Number(messageId);
  if (!Number.isFinite(mid) || mid <= 0) return await getPendingQueue(userId);

  // 【优化】使用 safeGetJSON 安全读取
  let arr = await safeGetJSON(pendingQueueKey(userId), []);
  if (!Array.isArray(arr)) arr = [];

  if (message && typeof message === 'object') {
    await KV.put(pendingMessageKey(userId, mid), JSON.stringify(buildPendingMessageSnapshot(message, userId)), {
      expirationTtl: CONFIG.PENDING_QUEUE_TTL_SECONDS
    });
  }

  // 【优化】去重检查：避免同一消息重复添加
  if (arr.includes(mid)) {
    Logger.debug('duplicate_message_skipped', { userId, messageId: mid });
    return arr;
  }

  arr.push(mid);

  // 【优化】保持顺序并限制队列长度（保留最新的）
  if (arr.length > CONFIG.PENDING_MAX_MESSAGES) {
    arr = arr.slice(-CONFIG.PENDING_MAX_MESSAGES);
  }

  try {
    await KV.put(pendingQueueKey(userId), JSON.stringify(arr), {
      expirationTtl: CONFIG.PENDING_QUEUE_TTL_SECONDS
    });
  } catch (e) {
    Logger.error('append_pending_queue_failed', e, { userId, messageId });
  }

  return arr;
}

// 清空暂存队列
async function clearPendingQueue(userId) {
  try {
    await KV.delete(pendingQueueKey(userId));
  } catch (e) {
    Logger.error('clear_pending_queue_failed', e, { userId });
  }
}

async function getPendingMessageSnapshot(userId, messageId) {
  return await safeGetJSON(pendingMessageKey(userId, messageId), null);
}

async function deletePendingMessageSnapshot(userId, messageId) {
  try {
    await KV.delete(pendingMessageKey(userId, messageId));
  } catch (e) {
    Logger.warn('delete_pending_message_snapshot_failed', e, { userId, messageId });
  }
}

// 验证通过后处理暂存消息
async function processPendingMessagesAfterVerification(userId) {
  // 【优化】使用 safeGetJSON 安全读取
  const pendingIds = await safeGetJSON(pendingQueueKey(userId), []);

  if (!Array.isArray(pendingIds) || pendingIds.length === 0) {
    return { forwarded: 0, failed: 0 };
  }

  Logger.info('processing_pending_messages', { userId, count: pendingIds.length });

  let forwarded = 0;
  let failed = 0;
  const failedMessages = [];

  // 【优化】去重并排序，保持消息顺序
  const uniqueIds = [...new Set(pendingIds)];
  const sortedIds = uniqueIds.sort((a, b) => a - b);

  const topicEnabled = await isTopicForwardingEnabled();
  let topicContext = null;
  if (topicEnabled) {
    topicContext = await ensureUserTopic(userId, await getUserProfile(userId));
  }

  const targetsForPending = topicContext && topicContext.threadId
    ? [{ chatId: GROUP_ID, threadId: topicContext.threadId, label: 'topic' }]
    : ADMIN_ID_LIST.map(adminId => ({ chatId: adminId, label: 'admin_dm' }));

  // 【优化】批量处理，添加小延迟避免触发限制
  for (let i = 0; i < sortedIds.length; i++) {
    const msgId = sortedIds[i];
    try {
      const pendingMessage = await getPendingMessageSnapshot(userId, msgId);
      if (pendingMessage) {
        const spamCheck = await checkSpam(pendingMessage, userId);
        if (spamCheck.isSpam) {
          Logger.info('pending_spam_blocked_after_verification', { userId, messageId: msgId, reason: spamCheck.reason });
          await deletePendingMessageSnapshot(userId, msgId);
          continue;
        }
      }

      const pendingMessageRef = { chat: { id: userId }, message_id: msgId };
      const results = await Promise.all(targetsForPending.map(target =>
        forwardMessagesToTarget([pendingMessageRef], userId, target)
      ));

      if (results.some(result => result?.ok)) {
        forwarded++;
        await deletePendingMessageSnapshot(userId, msgId);
      } else if (results.some(result => result?.errorType === 'message_not_found')) {
        Logger.warn('pending_message_not_found', { userId, messageId: msgId });
        await deletePendingMessageSnapshot(userId, msgId);
      } else {
        failed++;
        failedMessages.push(msgId);
      }
    } catch (e) {
      Logger.error('forward_pending_message_failed', e, { userId, messageId: msgId });
      failed++;
      failedMessages.push(msgId);
    }

    // 【优化】每5条消息添加小延迟，避免触发限制
    if ((i + 1) % 5 === 0 && i < sortedIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 【优化】清空已处理的队列
  if (failedMessages.length === 0) {
    await clearPendingQueue(userId);
  } else {
    // 保留失败的消息，下次重试
    try {
      await KV.put(pendingQueueKey(userId), JSON.stringify(failedMessages), {
        expirationTtl: CONFIG.PENDING_QUEUE_TTL_SECONDS
      });
      Logger.info('pending_messages_partially_failed', { userId, failedCount: failedMessages.length });
    } catch (e) {
      Logger.error('save_failed_pending_messages_failed', e, { userId });
    }
  }

  // 【修复】不再在此处通知用户，由调用方统一处理，避免重复通知
  // 通知用户的功能已移至验证成功后的代码中

  Logger.info('pending_messages_processed', { userId, forwarded, failed });
  return { forwarded, failed };
}

// ========== 用户资料缓存 ==========

// 用户资料缓存 key
function userProfileKey(userId) {
  return `user_profile:${userId}`;
}

// 用户资料更新冷却 key
function userProfileCooldownKey(userId) {
  return `profile:cooldown:${userId}`;
}

// 从 Telegram Update 中提取并缓存用户资料
async function upsertUserProfileFromUpdate(user) {
  try {
    if (!user || !user.id) return null;

    const userId = user.id.toString();

    // 检查冷却期
    const cooldownKey = userProfileCooldownKey(userId);
    const cooldown = await KV.get(cooldownKey);
    if (cooldown) return null; // 冷却期内不更新

    // 构建用户资料
    const profile = {
      id: userId,
      username: user.username || null,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      updated_at: Date.now()
    };

    // 保存到 KV
    await KV.put(userProfileKey(userId), JSON.stringify(profile), {
      expirationTtl: CONFIG.USER_PROFILE_CACHE_TTL
    });

    // 设置冷却期
    await KV.put(cooldownKey, "1", { expirationTtl: CONFIG.USER_PROFILE_COOLDOWN });

    Logger.debug('user_profile_cached', { userId, username: profile.username });
    return profile;
  } catch (e) {
    Logger.error('upsert_user_profile_failed', e, { userId: user?.id });
    return null;
  }
}

// 获取用户资料
async function getUserProfile(userId) {
  try {
    const data = await KV.get(userProfileKey(userId));
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    Logger.error('get_user_profile_failed', e, { userId });
    return null;
  }
}

// 获取用户显示名称（优先使用缓存的资料）
async function getUserDisplayName(userId) {
  // 1. 尝试从缓存获取
  const profile = await getUserProfile(userId);
  if (profile) {
    if (profile.first_name || profile.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    if (profile.username) {
      return `@${profile.username}`;
    }
  }

  // 2. 回退到已验证用户列表中的名称
  const verifiedName = await KV.get('verified-' + userId);
  if (verifiedName && verifiedName !== 'true') {
    return verifiedName;
  }

  return 'Unknown';
}

// 检查用户是否已验证（优先使用内存缓存，带重试机制）
async function isUserVerified(userId) {
  const verifiedKey = 'verified-' + userId;

  const memVerified = memGet(verifiedKey);
  if (memVerified !== undefined) {
    return memVerified === "true";
  }

  const cacheApiValue = await cacheApiGet(verifiedKey);
  if (cacheApiValue !== undefined) {
    const isVerified = cacheApiValue === 'true';
    memSet(verifiedKey, cacheApiValue, 5 * 60 * 1000);
    if (isVerified) return true;
  }

  const maxRetries = 3;
  const retryDelay = 1500;

  for (let i = 0; i < maxRetries; i++) {
    const kvVerified = await KV.get(verifiedKey);
    if (kvVerified === 'true') {
      memSet(verifiedKey, 'true', 5 * 60 * 1000);
      await cacheApiSet(verifiedKey, 'true', 300);
      return true;
    }

    if (i < maxRetries - 1) {
      await new Promise(r => setTimeout(r, retryDelay));
    }
  }

  return false;
}

// 获取所有白名单用户
// 【优化】L1 缓存白名单字符串（30 秒），降低 onMessage 热路径上的 KV 读取
const WHITELIST_CACHE_KEY = '__whitelist_cache__';
const WHITELIST_CACHE_TTL_MS = 30 * 1000;

async function getWhitelist() {
  const cached = memGet(WHITELIST_CACHE_KEY);
  if (cached !== undefined) {
    return cached;
  }
  const cacheApiValue = await cacheApiGet(WHITELIST_CACHE_KEY);
  if (cacheApiValue !== undefined) {
    memSet(WHITELIST_CACHE_KEY, cacheApiValue, WHITELIST_CACHE_TTL_MS);
    return cacheApiValue;
  }
  const whitelistData = await KV.get('whitelist-data');
  const list = whitelistData ? whitelistData.split(',').filter(v => v) : [];
  memSet(WHITELIST_CACHE_KEY, list, WHITELIST_CACHE_TTL_MS);
  await cacheApiSet(WHITELIST_CACHE_KEY, list, 120);
  return list;
}

async function invalidateWhitelistCache() {
  memDelete(WHITELIST_CACHE_KEY);
  await cacheApiDelete(WHITELIST_CACHE_KEY);
}

// 检查用户是否在白名单中
async function isWhitelisted(userId) {
  const whitelist = await getWhitelist();
  return whitelist.includes(String(userId));
}

// 添加用户到白名单
async function addToWhitelist(userId) {
  const whitelist = await getWhitelist();
  if (!whitelist.includes(userId)) {
    whitelist.push(userId);
    await KV.put('whitelist-data', whitelist.join(','));
    await invalidateWhitelistCache();
  }
}

async function removeFromWhitelist(userId) {
  const whitelist = await getWhitelist();
  const newWhitelist = whitelist.filter(id => id !== userId);
  await KV.put('whitelist-data', newWhitelist.join(','));
  await invalidateWhitelistCache();
}

// 【优化】带 L1 缓存的黑名单检查（用于热路径 onMessage）
// 黑名单变化通过 /ban /unban 触发，调用方需配合 invalidateBlockedCache 失效缓存
const BLOCKED_CACHE_TTL_MS = 60 * 1000;
async function isBlockedCached(userId) {
  const memKey = `blocked-${userId}`;
  const cached = memGet(memKey);
  if (cached !== undefined) {
    return cached === 'true';
  }
  const cacheApiValue = await cacheApiGet(memKey);
  if (cacheApiValue !== undefined) {
    const blocked = cacheApiValue === 'true';
    memSet(memKey, cacheApiValue, BLOCKED_CACHE_TTL_MS);
    return blocked;
  }
  const value = await KV.get('blocked-' + userId);
  const strVal = value ? 'true' : 'false';
  memSet(memKey, strVal, BLOCKED_CACHE_TTL_MS);
  await cacheApiSet(memKey, strVal, 120);
  return !!value;
}

async function invalidateBlockedCache(userId) {
  const memKey = `blocked-${userId}`;
  memDelete(memKey);
  await cacheApiDelete(memKey);
}

// ========== 管理员权限缓存 ==========
const adminCache = new Map();
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5分钟缓存

/**
 * 检查用户是否为管理员
 * 支持主管理员和额外管理员列表
 * @param {string} userId - 用户ID
 * @returns {boolean} 是否为管理员
 */
function isAdmin(userId) {
  // 检查主管理员和环境变量中的管理员
  if (ADMIN_ALLOWLIST.has(String(userId))) {
    return true;
  }

  // 检查缓存
  const cached = adminCache.get(userId);
  if (cached && (Date.now() - cached.ts < ADMIN_CACHE_TTL_MS)) {
    return cached.isAdmin;
  }

  // 未缓存或已过期，需要异步检查（返回 false，异步更新缓存）
  checkAdminStatus(userId).catch(() => { });
  return false;
}

/**
 * 异步检查管理员状态并缓存
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>}
 */
async function checkAdminStatus(userId) {
  // 检查额外管理员列表（可以从 KV 读取）
  try {
    const extraAdmins = await KV.get('extra_admins');
    if (extraAdmins) {
      const adminList = extraAdmins.split(',').map(id => id.trim());
      const isExtraAdmin = adminList.includes(String(userId));

      // 更新缓存
      adminCache.set(userId, {
        isAdmin: isExtraAdmin,
        ts: Date.now()
      });

      return isExtraAdmin;
    }
  } catch (e) {
    Logger.error('check_admin_status_failed', e, { userId });
  }

  // 默认不是管理员
  adminCache.set(userId, {
    isAdmin: false,
    ts: Date.now()
  });

  return false;
}

/**
 * 强制刷新管理员缓存
 * @param {string} userId - 用户ID
 */
function clearAdminCache(userId) {
  if (userId) {
    adminCache.delete(userId);
  } else {
    adminCache.clear();
  }
}

// 防刷屏限流器（支持多类型）
const rateLimitCache = new Map();

/**
 * 精细化速率限制检查
 * @param {string} userId - 用户ID
 * @param {string} type - 限制类型: 'message' | 'verify' | 'verifyAttempt'
 * @returns {object} { allowed: boolean, remaining: number, retryAfter?: number }
 */
function checkRateLimit(userId, type = 'message') {
  const config = RATE_LIMIT_CONFIG[type];
  if (!config) {
    Logger.warn('unknown_rate_limit_type', { type });
    return { allowed: true, remaining: 999, limit: 999 };
  }

  const now = Date.now();
  const key = `${config.keyPrefix}:${userId}`;
  let userData = rateLimitCache.get(key);

  // 动态调整限额
  let adjustedMaxRequests = config.maxRequests;
  if (RATE_LIMIT_ENHANCED.enabledDynamicLimit) {
    // 检查用户是否为信任用户
    const isTrusted = memGet(`trusted:${userId}`);
    if (isTrusted) {
      adjustedMaxRequests = Math.floor(
        config.maxRequests * RATE_LIMIT_ENHANCED.trustedUserMultiplier
      );
    }
  }

  if (!userData) {
    userData = { count: 1, firstRequest: now, violations: 0 };
    rateLimitCache.set(key, userData);
    return { allowed: true, remaining: adjustedMaxRequests - 1, limit: adjustedMaxRequests };
  }

  // 检查是否在时间窗口内
  if (now - userData.firstRequest > config.windowMs) {
    // 重置窗口
    userData.count = 1;
    userData.firstRequest = now;
    userData.violations = 0;
    rateLimitCache.set(key, userData);
    return { allowed: true, remaining: adjustedMaxRequests - 1, limit: adjustedMaxRequests };
  }

  // 在窗口内，检查次数
  if (userData.count >= adjustedMaxRequests) {
    const retryAfter = Math.ceil((config.windowMs - (now - userData.firstRequest)) / 1000);
    userData.violations = (userData.violations || 0) + 1;

    // 记录违规次数（用于分级限流）
    if (userData.violations >= RATE_LIMIT_ENHANCED.maxPenaltyCount) {
      Logger.warn('rate_limit_violation_excessive', {
        userId,
        type,
        violations: userData.violations,
        retryAfter
      });
    }

    return {
      allowed: false,
      retryAfter,
      limit: adjustedMaxRequests,
      violations: userData.violations
    };
  }

  userData.count++;
  return {
    allowed: true,
    remaining: adjustedMaxRequests - userData.count,
    limit: adjustedMaxRequests
  };
}

/**
 * 检查验证请求频率限制（KV 持久化，跨实例生效）
 * @param {string} userId - 用户ID
 * @param {string} type - 限制类型
 * @returns {Promise<object>} 速率限制结果
 */
async function checkRateLimitKV(userId, type = 'verify') {
  const config = RATE_LIMIT_CONFIG[type];
  if (!config) {
    return { allowed: true, remaining: 999 };
  }

  const key = `${config.keyPrefix}:${userId}`;
  const now = Date.now();
  const windowMs = config.windowMs;

  // 使用 safeGetJSON 获取历史记录
  let timestamps = await safeGetJSON(key, []);
  if (!Array.isArray(timestamps)) timestamps = [];

  // 过滤掉过期的记录
  timestamps = timestamps.filter(ts => (now - ts) < windowMs);

  if (timestamps.length >= config.maxRequests) {
    const oldestTimestamp = timestamps[0];
    const retryAfter = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
    return { allowed: false, retryAfter, limit: config.maxRequests };
  }

  // 添加新记录
  timestamps.push(now);
  await KV.put(key, JSON.stringify(timestamps), {
    expirationTtl: Math.ceil(windowMs / 1000) + 60
  });

  return { allowed: true, remaining: config.maxRequests - timestamps.length };
}

// 已验证用户列表管理。每个用户独立存储，避免并发验证覆盖共享列表。
const VERIFIED_USER_PREFIX = 'verified-user:';
const LEGACY_VERIFIED_USERS_KEY = 'verified_users_list_v2';

async function addVerifiedUser(userId, userInfo = null) {
  try {
    const userIdStr = String(userId);
    const userName = userInfo || await getUserDisplayName(userIdStr) || 'Unknown';
    await KV.put(`${VERIFIED_USER_PREFIX}${userIdStr}`, userName);
  } catch (e) {
    Logger.error('add_verified_user_failed', e, { userId });
  }
}

async function removeVerifiedUser(userId) {
  try {
    const userIdStr = String(userId);
    await KV.delete(`${VERIFIED_USER_PREFIX}${userIdStr}`);

    const users = await KV.get(LEGACY_VERIFIED_USERS_KEY);
    if (users) {
      const userMap = new Map(JSON.parse(users));
      if (userMap.delete(userIdStr)) {
        await KV.put(LEGACY_VERIFIED_USERS_KEY, JSON.stringify([...userMap]));
      }
    }
  } catch (e) {
    Logger.error('remove_verified_user_failed', e, { userId });
  }
}

async function getAllVerifiedUsers() {
  try {
    const normalizedMap = new Map();
    const legacyUsers = await KV.get(LEGACY_VERIFIED_USERS_KEY);
    if (legacyUsers) {
      for (const [userId, userName] of JSON.parse(legacyUsers)) {
        const userIdStr = String(userId);
        if (await KV.get(`verified-${userIdStr}`) === 'true') {
          normalizedMap.set(userIdStr, userName);
        }
      }
    }

    let cursor;
    do {
      const result = await KV.list({ prefix: VERIFIED_USER_PREFIX, cursor, limit: 1000 });
      for (const key of result.keys) {
        const userId = key.name.slice(VERIFIED_USER_PREFIX.length);
        const userName = await KV.get(key.name);
        if (userName !== null) normalizedMap.set(userId, userName);
      }
      cursor = result.list_complete ? null : result.cursor;
    } while (cursor);

    return [...normalizedMap];
  } catch (e) {
    Logger.error('get_verified_users_failed', e);
    return [];
  }
}

// 配置管理
const CONFIG_KEYS = {
  WELCOME_MSG: 'config:welcome_msg',
  AUTO_REPLY_MSG: 'config:auto_reply_msg',
  VERIFY_TTL: 'config:verify_ttl',
  UNION_BAN: 'config:union_ban',
  FORWARD_MODE: 'config:forward_mode'
};

const FORWARD_MODES = {
  DIRECT: 'direct',
  TOPIC: 'topic'
};

async function getConfig(key, defaultValue = null) {
  const cacheKey = `cfg:${key}`;
  let value = memGet(cacheKey);
  if (value !== undefined) return value;

  value = await cacheApiGet(cacheKey);
  if (value !== undefined) {
    memSet(cacheKey, value);
    return value;
  }

  value = await KV.get(key);
  if (value !== null) {
    memSet(cacheKey, value);
    await cacheApiSet(cacheKey, value, 300);
  }
  return value !== null ? value : defaultValue;
}

async function setConfig(key, value) {
  await KV.put(key, value);
  const cacheKey = `cfg:${key}`;
  memSet(cacheKey, value);
  await cacheApiSet(cacheKey, value, 300);
}

async function getForwardMode() {
  const mode = await getConfig(CONFIG_KEYS.FORWARD_MODE, FORWARD_MODES.DIRECT);
  return mode === FORWARD_MODES.TOPIC ? FORWARD_MODES.TOPIC : FORWARD_MODES.DIRECT;
}

async function setForwardMode(mode) {
  const next = mode === FORWARD_MODES.TOPIC ? FORWARD_MODES.TOPIC : FORWARD_MODES.DIRECT;
  await setConfig(CONFIG_KEYS.FORWARD_MODE, next);
  return next;
}

function hasTopicForwardingPrerequisites() {
  return Boolean(GROUP_ID && ADMIN_UID);
}

async function getBotSelfProfile(force = false) {
  const cached = memGet(BOT_SELF_CACHE_KEY);
  if (cached && !force) return cached;

  const result = await requestTelegram('getMe', {});
  if (!result.ok || !result.result) {
    throw new Error(result.description || 'getMe_failed');
  }
  memSet(BOT_SELF_CACHE_KEY, result.result, BOT_SELF_CACHE_TTL_MS);
  return result.result;
}

async function performTopicEnvironmentCheck() {
  if (!GROUP_ID) {
    return { ok: false, reason: 'group_missing' };
  }
  try {
    const chatInfo = await requestTelegram('getChat', { chat_id: GROUP_ID });
    if (!chatInfo.ok) {
      return { ok: false, reason: 'chat_inaccessible', description: chatInfo.description };
    }
    if (!chatInfo.result || chatInfo.result.is_forum === false) {
      return { ok: false, reason: 'not_forum' };
    }

    const botProfile = await getBotSelfProfile();
    const memberInfo = await requestTelegram('getChatMember', { chat_id: GROUP_ID, user_id: botProfile.id });
    if (!memberInfo.ok) {
      return { ok: false, reason: 'membership', description: memberInfo.description };
    }
    const rights = memberInfo.result;
    if (rights.status !== 'administrator') {
      return { ok: false, reason: 'not_admin' };
    }
    if (!rights.can_manage_topics) {
      return { ok: false, reason: 'missing_manage_topics' };
    }
    return { ok: true };
  } catch (e) {
    Logger.error('topic_env_check_failed', e);
    return { ok: false, reason: 'unknown', description: e.message };
  }
}

async function verifyTopicEnvironment(options = {}) {
  const { force = false, notifyOnFailure = true } = options;
  if (!GROUP_ID) {
    return { ok: false, reason: 'group_missing' };
  }

  if (!force) {
    const cached = memGet(TOPIC_ENV_CACHE_KEY);
    if (cached) return cached;
  }

  const status = await performTopicEnvironmentCheck();
  memSet(TOPIC_ENV_CACHE_KEY, status, TOPIC_ENV_CACHE_TTL_MS);

  if (!status.ok && notifyOnFailure) {
    await maybeNotifyTopicEnvIssue(status);
  }
  return status;
}

function describeTopicEnvIssue(status, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const desc = status.description || (L === 'zh' ? '未知错误' : 'unknown error');
  switch (status.reason) {
    case 'group_missing':
      return t(L, 'topic_issue_group_missing');
    case 'chat_inaccessible':
      return t(L, 'topic_issue_chat_inaccessible', { description: desc });
    case 'not_forum':
      return t(L, 'topic_issue_not_forum');
    case 'not_admin':
      return t(L, 'topic_issue_not_admin');
    case 'missing_manage_topics':
      return t(L, 'topic_issue_missing_manage_topics');
    case 'membership':
      return t(L, 'topic_issue_membership', { description: desc });
    default:
      return status.description || t(L, 'topic_issue_default');
  }
}

async function maybeNotifyTopicEnvIssue(status) {
  if (!ADMIN_UID) return;
  const last = memGet(TOPIC_ENV_ALERT_CACHE_KEY);
  if (last && Date.now() - last < TOPIC_ENV_ALERT_COOLDOWN_MS) return;

  memSet(TOPIC_ENV_ALERT_CACHE_KEY, Date.now(), TOPIC_ENV_ALERT_COOLDOWN_MS);
  const lang = await getUserLang(ADMIN_UID);
  const text = t(lang, 'topic_env_notice', { issue: describeTopicEnvIssue(status, lang) });
  try {
    await sendMessage({
      chat_id: ADMIN_UID,
      text
    });
  } catch (e) {
    Logger.warn('topic_env_notice_failed', e);
  }
}

async function isTopicForwardingEnabled() {
  if (!hasTopicForwardingPrerequisites()) return false;
  const mode = await getForwardMode();
  return mode === FORWARD_MODES.TOPIC;
}

// 错误上报
async function reportError(error, context = "") {
  try {
    if (!ADMIN_UID || !TOKEN) return;
    const reportLang = await getUserLang(ADMIN_UID);
    const errorText = t(reportLang, 'error_report', { context, error: error.message, time: new Date().toISOString() });
    await sendMessage({
      chat_id: ADMIN_UID,
      text: errorText,
      parse_mode: 'HTML'
    });
  } catch (e) {
    Logger.error('report_error_failed', e);
  }
}

// 广播功能 - 获取所有已验证用户
async function getVerifiedUsers() {
  // 使用已验证用户列表
  return await getAllVerifiedUsers();
}

// 分批广播辅助函数（参考 RelayGo 实现）
// 【优化】
// 1. 修复隐藏 Bug：getVerifiedUsers() 返回 [[userId, name], ...]，旧实现 for-of 直接拿到数组当 userId 使用，
//    导致 'blocked-' + userId 拼接错误且 sendMessage chat_id 也是数组。
// 2. 进入批次前一次性预读全部 blocked 用户到 Set，避免 N 次 KV.get('blocked-*')，
//    在 500 用户广播时可节省 ~500 次 KV 读取（约 5% 的免费日额度）。
async function sendBroadcastBatch(broadcastMsg, offset, batchSize) {
  const users = await getVerifiedUsers();
  const total = users.length;
  const batch = users.slice(offset, offset + batchSize);

  // 【优化】一次性预读全部 blocked 用户 ID 到内存 Set
  const blockedSet = await loadBlockedUsersSet();

  let sent = 0, failed = 0, skipped = 0;
  let processed = offset;
  const startTime = Date.now();
  const maxDuration = 25000; // 25秒超时
  let timedOut = false;

  for (const [index, entry] of batch.entries()) {
    // 兼容旧/新两种数据结构：[userId, name] 或 userId 字符串
    const userId = Array.isArray(entry) ? String(entry[0]) : String(entry);

    // 超时检查
    if (Date.now() - startTime > maxDuration) {
      timedOut = true;
      break;
    }
    processed = offset + index + 1;

    // 【优化】内存集合 O(1) 查找，无需 KV 调用
    if (blockedSet.has(userId)) {
      skipped++;
      continue;
    }

    try {
      const result = await sendMessage({
        chat_id: userId,
        text: broadcastMsg,
        parse_mode: 'HTML'
      });
      if (result.ok) sent++;
      else failed++;
    } catch (e) {
      failed++;
    }

    // 每25条消息暂停1秒，避免触发限制
    if ((sent + failed) % 25 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const hasMore = processed < total;

  return {
    sent: offset + sent,
    failed,
    skipped,
    total,
    hasMore,
    nextOffset: processed,
    timedOut
  };
}

// 【优化】一次性加载所有被封禁用户 ID 集合（用于广播预过滤）
// 使用 KV.list 进行游标分页扫描，相比逐条 KV.get 大幅降低读次数
async function loadBlockedUsersSet() {
  const blocked = new Set();
  let cursor;
  try {
    while (true) {
      const result = await KV.list({ prefix: 'blocked-', limit: 1000, cursor });
      for (const k of result.keys) {
        blocked.add(k.name.replace(/^blocked-/, ''));
      }
      // Cloudflare KV: list_complete 或 cursor 为 undefined 表示遍历结束
      if (result.list_complete || !result.cursor) break;
      cursor = result.cursor;
    }
  } catch (e) {
    Logger.error('load_blocked_set_failed', e);
  }
  return blocked;
}

// 统计功能
async function incrementMessageCount() {
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `stats:messages:${today}`;
  const totalKey = 'stats:messages:total';

  try {
    const [dailyCount, totalCount] = await Promise.all([
      KV.get(dailyKey),
      KV.get(totalKey),
    ]);
    await Promise.all([
      KV.put(dailyKey, String(parseInt(dailyCount || '0') + 1), { expirationTtl: 86400 * 30 }),
      KV.put(totalKey, String(parseInt(totalCount || '0') + 1)),
    ]);
  } catch (e) {
    Logger.error('increment_message_count_failed', e);
  }
}

async function recordActiveUser(userId) {
  const today = new Date().toISOString().split('T')[0];
  const key = `stats:active_users:${today}`;

  try {
    const users = await KV.get(key);
    const userSet = users ? JSON.parse(users) : [];

    if (!userSet.includes(userId)) {
      userSet.push(userId);
      await KV.put(key, JSON.stringify(userSet), { expirationTtl: 86400 * 7 });
    }
  } catch (e) {
    Logger.error('record_active_user_failed', e);
  }
}

async function getStats() {
  const today = new Date().toISOString().split('T')[0];

  try {
    const [totalMessages, todayMessages, activeUsers] = await Promise.all([
      KV.get('stats:messages:total'),
      KV.get(`stats:messages:${today}`),
      KV.get(`stats:active_users:${today}`),
    ]);
    const todayActiveCount = activeUsers ? JSON.parse(activeUsers).length : 0;

    return {
      totalMessages: parseInt(totalMessages || '0'),
      todayMessages: parseInt(todayMessages || '0'),
      todayActiveUsers: todayActiveCount
    };
  } catch (e) {
    Logger.error('get_stats_failed', e);
    return {
      totalMessages: 0,
      todayMessages: 0,
      todayActiveUsers: 0
    };
  }
}

// 媒体组处理
// 【优化】事件驱动的媒体组聚合，避免固定 300ms 轮询消耗 CPU 时间。
// 算法语义保持不变：距最后一条消息静默 MEDIA_GROUP_WAIT_MS 后即提交，
// 或达到 MEDIA_GROUP_MAX_WAIT_MS 上限强制提交。
const mediaGroupBuffers = new Map();
const MEDIA_GROUP_WAIT_MS = 300;
const MEDIA_GROUP_MAX_WAIT_MS = 3000;

async function handleMediaGroup(msg, handler) {
  if (!msg.media_group_id) {
    return handler([msg]);
  }

  const groupKey = msg.media_group_id;
  let buffer = mediaGroupBuffers.get(groupKey);
  const isFirst = !buffer;

  if (isFirst) {
    buffer = {
      messages: [],
      handler,
      lastUpdate: 0,
      // 【优化】用 timerId 记录当前等待计时器，新消息到达可重置
      timerId: null,
      // resolver 用于通知"等待结束"
      resolver: null,
      maxDeadline: Date.now() + MEDIA_GROUP_MAX_WAIT_MS
    };
    mediaGroupBuffers.set(groupKey, buffer);
  }

  buffer.messages.push(msg);
  buffer.lastUpdate = Date.now();

  // 【优化】每条新消息到达时重置"静默 300ms"计时器（debounce 模式）
  if (buffer.timerId) {
    clearTimeout(buffer.timerId);
    buffer.timerId = null;
  }

  if (!isFirst) {
    // 后续到达的消息：只需重置计时器，由首条负责最终处理
    if (buffer.resolver) {
      const remaining = Math.max(0, buffer.maxDeadline - Date.now());
      const waitMs = Math.min(MEDIA_GROUP_WAIT_MS, remaining);
      buffer.timerId = setTimeout(() => {
        buffer.timerId = null;
        if (buffer.resolver) {
          const fn = buffer.resolver;
          buffer.resolver = null;
          fn();
        }
      }, waitMs);
    }
    return;
  }

  // 首条消息：负责等待并最终提交
  await new Promise(resolve => {
    buffer.resolver = resolve;
    const remaining = Math.max(0, buffer.maxDeadline - Date.now());
    const waitMs = Math.min(MEDIA_GROUP_WAIT_MS, remaining);
    buffer.timerId = setTimeout(() => {
      buffer.timerId = null;
      if (buffer.resolver) {
        const fn = buffer.resolver;
        buffer.resolver = null;
        fn();
      }
    }, waitMs);

    // 防御：即使后续重置无限延后，也要在 MAX 时间强制结束
    setTimeout(() => {
      if (buffer.resolver) {
        if (buffer.timerId) {
          clearTimeout(buffer.timerId);
          buffer.timerId = null;
        }
        const fn = buffer.resolver;
        buffer.resolver = null;
        fn();
      }
    }, MEDIA_GROUP_MAX_WAIT_MS);
  });

  mediaGroupBuffers.delete(groupKey);
  buffer.messages.sort((a, b) => a.message_id - b.message_id);
  return buffer.handler(buffer.messages);
}

// =================================================================
//                      核心功能
// =================================================================

// Telegram API 基础 URL（可配置，用于代理场景）
let API_BASE = 'https://api.telegram.org';

/**
 * 设置自定义 API 基础 URL
 * @param {string} baseUrl - API 基础 URL
 */
function setApiBase(baseUrl) {
  if (baseUrl && typeof baseUrl === 'string') {
    // 【安全】强制 HTTPS
    if (baseUrl.startsWith('http://')) {
      Logger.warn('api_http_upgraded', { originalBase: baseUrl });
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    // 验证 URL 格式
    try {
      new URL(baseUrl);
      API_BASE = baseUrl;
    } catch (e) {
      Logger.error('invalid_api_base', e, { baseUrl });
    }
  }
}

function apiUrl(methodName, params = null) {
  let query = '';
  if (params) {
    query = '?' + new URLSearchParams(params).toString();
  }
  return `${API_BASE}/bot${TOKEN}/${methodName}${query}`;
}

/**
 * Telegram API 错误分类
 * @param {string} description - 错误描述
 * @returns {string} 错误类型
 */
function classifyTelegramError(description) {
  if (!description) return 'unknown';
  const desc = description.toLowerCase();

  // 消息相关错误
  if (desc.includes('message thread not found') || desc.includes('topic not found')) {
    return 'thread_not_found';
  }
  if (desc.includes('message to forward not found') || desc.includes('message not found')) {
    return 'message_not_found';
  }
  if (desc.includes('message text is empty') || desc.includes('message is empty')) {
    return 'empty_message';
  }
  if (desc.includes('message is too long') || desc.includes('text is too long')) {
    return 'message_too_long';
  }

  // 用户相关错误
  if (desc.includes('chat not found') || desc.includes('user not found')) {
    return 'chat_not_found';
  }
  if (desc.includes('bot was blocked') || desc.includes('blocked by user')) {
    return 'bot_blocked';
  }
  if (desc.includes('user is deactivated')) {
    return 'user_deactivated';
  }

  // 权限错误
  if (desc.includes('not enough rights') || desc.includes('forbidden')) {
    return 'permission_denied';
  }

  // 速率限制
  if (desc.includes('too many requests') || desc.includes('retry after')) {
    return 'rate_limited';
  }

  // 网络错误
  if (desc.includes('network') || desc.includes('timeout') || desc.includes('fetch')) {
    return 'network_error';
  }

  // 验证错误
  if (desc.includes('unauthorized') || desc.includes('invalid token')) {
    return 'auth_error';
  }

  return 'unknown';
}

/**
 * 获取用户友好的错误消息
 * @param {string} errorType - 错误类型
 * @param {string} defaultMsg - 默认消息
 * @returns {string} 用户友好消息
 */
function getUserFriendlyErrorMessage(errorType, defaultMsg = null, lang = null) {
  const L = normalizeLang(lang) || getDefaultLang();
  const keys = {
    message_not_found: 'err_message_not_found',
    empty_message: 'err_empty_message',
    message_too_long: 'err_message_too_long',
    chat_not_found: 'err_chat_not_found',
    bot_blocked: 'err_bot_blocked',
    user_deactivated: 'err_user_deactivated',
    permission_denied: 'err_permission_denied',
    rate_limited: 'err_rate_limited',
    network_error: 'err_network_error',
    auth_error: 'err_auth_error',
    timeout: 'err_timeout',
    unknown: null
  };
  if (keys[errorType]) return t(L, keys[errorType]);
  return defaultMsg || t(L, 'err_generic');
}


async function requestTelegram(methodName, body, params = null, timeout = CONFIG.API_TIMEOUT_MS) {
  // 【安全改进】添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(apiUrl(methodName, params), {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 记录服务器错误
    if (!resp.ok && resp.status >= 500) {
      Logger.warn('telegram_api_server_error', { method: methodName, status: resp.status });
    }

    const result = await resp.json();

    // 【优化】错误分类处理
    if (!result.ok && result.description) {
      const errorType = classifyTelegramError(result.description);
      result.errorType = errorType;
      result.userMessage = getUserFriendlyErrorMessage(errorType);

      // 记录特定错误类型
      if (errorType === 'rate_limited') {
        const retryAfter = result.parameters?.retry_after || 5;
        Logger.warn('telegram_api_rate_limit', { method: methodName, retryAfter });
      } else if (errorType === 'bot_blocked') {
        Logger.info('bot_blocked_by_user', { method: methodName, chatId: body?.chat_id });
      } else if (errorType !== 'unknown') {
        Logger.warn('telegram_api_error', { method: methodName, errorType, description: result.description });
      }
    }

    return result;
  } catch (e) {
    clearTimeout(timeoutId);

    if (e.name === 'AbortError') {
      Logger.error('telegram_api_timeout', e, { method: methodName, timeout });
      return {
        ok: false,
        description: 'Request timeout',
        errorType: 'timeout',
        userMessage: getUserFriendlyErrorMessage('timeout')
      };
    }

    Logger.error('telegram_api_failed', e, { method: methodName });
    return {
      ok: false,
      description: e.message,
      errorType: 'network_error',
      userMessage: getUserFriendlyErrorMessage('network_error')
    };
  }
}

function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', msg);
}

function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', msg);
}

async function forwardMessage(msg = {}) {
  const result = await requestTelegram('forwardMessage', msg);
  if (shouldFallbackToCopy(result)) {
    return requestTelegram('copyMessage', msg);
  }
  return result;
}

async function forwardMessagesWithFallback(msg = {}) {
  const result = await requestTelegram('forwardMessages', msg);
  if (shouldFallbackToCopy(result)) {
    return requestTelegram('copyMessages', msg);
  }
  return result;
}

function shouldFallbackToCopy(result) {
  if (!result || result.ok) return false;
  if (result.errorType === 'message_not_found') return true;
  const desc = (result.description || '').toLowerCase();
  return desc.includes('message to forward not found') || desc.includes('content private');
}

function isForwardedToExpectedThread(result, target) {
  if (!target?.threadId || !result?.ok) return true;
  const messages = Array.isArray(result.result) ? result.result : [result.result];
  return messages.every(msg => {
    if (!msg) return false;
    // copyMessage/copyMessages 返回 MessageId（无 message_thread_id），无法校验线程，
    // payload 已指定 message_thread_id，由 Telegram 保证投递到正确话题 → 视为通过
    if (msg.message_thread_id === undefined || msg.message_thread_id === null) return true;
    return Number(msg.message_thread_id) === Number(target.threadId);
  });
}

async function deleteForwardedResultMessages(result, target) {
  if (!target?.chatId || !result?.ok) return;
  const messages = Array.isArray(result.result) ? result.result : [result.result];
  for (const msg of messages) {
    if (!msg?.message_id) continue;
    try {
      await requestTelegram('deleteMessage', {
        chat_id: target.chatId,
        message_id: msg.message_id
      });
    } catch (e) {
      Logger.warn('delete_misdirected_forward_failed', e, { chatId: target.chatId, messageId: msg.message_id });
    }
  }
}

// 设置 Telegram 命令列表
async function setBotCommands() {
  const userCommandsEn = [
    { command: 'start', description: 'Start verification / chat' },
    { command: 'help', description: 'Show help' },
    { command: 'language', description: 'Switch language' },
  ];
  const userCommandsZh = [
    { command: 'start', description: '开始验证 / 开始对话' },
    { command: 'help', description: '查看使用说明' },
    { command: 'language', description: '切换语言' },
  ];
  const adminCommandsEn = [
    { command: 'menu', description: 'Open admin panel' },
    { command: 'help', description: 'Show admin help' },
    { command: 'language', description: 'Switch language' },
    { command: 'ban', description: 'Block a user' },
    { command: 'unban', description: 'Unblock a user' },
    { command: 'trust', description: 'Trust a user (skip checks)' },
    { command: 'untrust', description: 'Remove trust' },
    { command: 'reset', description: 'Reset user verification' },
    { command: 'broadcast', description: 'Broadcast to all users' },
    { command: 'welcome', description: 'Set welcome message' },
    { command: 'autoreply', description: 'Set auto-reply' },
    { command: 'cleanup', description: 'Clean up invalid topics' },
    { command: 'cachestats', description: 'View cache statistics' },
  ];
  const adminCommandsZh = [
    { command: 'menu', description: '打开管理面板' },
    { command: 'help', description: '查看管理员帮助' },
    { command: 'language', description: '切换语言' },
    { command: 'ban', description: '封禁用户' },
    { command: 'unban', description: '解除封禁' },
    { command: 'trust', description: '信任用户（跳过检查）' },
    { command: 'untrust', description: '取消信任' },
    { command: 'reset', description: '重置用户验证状态' },
    { command: 'broadcast', description: '广播消息给所有用户' },
    { command: 'welcome', description: '设置欢迎消息' },
    { command: 'autoreply', description: '设置自动回复' },
    { command: 'cleanup', description: '清理失效话题映射' },
    { command: 'cachestats', description: '查看缓存统计信息' },
  ];
  try {
    await requestTelegram('setMyCommands', {
      commands: userCommandsEn,
      scope: { type: 'default' }
    });
    await requestTelegram('setMyCommands', {
      commands: userCommandsZh,
      scope: { type: 'default' },
      language_code: 'zh'
    });
    Logger.info('user_commands_set', { count: userCommandsEn.length });
    const adminTargets = ADMIN_ID_LIST.length ? ADMIN_ID_LIST : (ADMIN_UID ? [ADMIN_UID] : []);
    for (const adminId of adminTargets) {
      await requestTelegram('setMyCommands', {
        commands: adminCommandsEn,
        scope: { type: 'chat', chat_id: adminId }
      });
      await requestTelegram('setMyCommands', {
        commands: adminCommandsZh,
        scope: { type: 'chat', chat_id: adminId },
        language_code: 'zh'
      });
    }
    Logger.info('admin_commands_set', { admins: adminTargets.length, commands: adminCommandsEn.length });
  } catch (e) {
    Logger.error('set_commands_failed', e);
  }
}


/**
 * 验证环境变量配置
 * @returns {object} { valid: boolean, error?: string, missing?: string[] }
 */
function validateEnvironment() {
  const missing = [];
  const invalid = [];

  // 检查必需变量
  if (!TOKEN) missing.push('ENV_BOT_TOKEN');
  if (!SECRET) missing.push('ENV_BOT_SECRET');
  if (!ADMIN_ID_LIST.length) missing.push('ENV_ADMIN_UID or ADMIN_IDS');

  if (missing.length > 0) {
    return {
      valid: false,
      error: 'Missing required environment variables',
      missing
    };
  }

  // 验证 BOT_TOKEN 格式（应该包含冒号）
  if (!TOKEN.includes(':')) {
    invalid.push('ENV_BOT_TOKEN (should be in format: 123456:ABC-DEF...)');
  }

  // 验证 ADMIN_UID 是否为数字
  if (RAW_ADMIN_UID && !/^-?\d+$/.test(String(RAW_ADMIN_UID))) {
    invalid.push('ENV_ADMIN_UID (should be a numeric ID)');
  }

  if (ADMIN_IDS_ENV) {
    const rawIds = ADMIN_IDS_ENV.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    const invalidIds = rawIds.filter(id => !/^-?\d+$/.test(id));
    if (invalidIds.length) {
      invalid.push('ADMIN_IDS (all entries must be numeric Telegram user IDs)');
    }
  }

  // 验证 SECRET 长度（建议至少 16 个字符）
  if (String(SECRET).length < 16) {
    invalid.push('ENV_BOT_SECRET (should be at least 16 characters for security)');
  }

  if (invalid.length > 0) {
    return {
      valid: false,
      error: 'Invalid environment variable format',
      missing: invalid
    };
  }

  return { valid: true };
}

addEventListener('fetch', event => {
  // 【优化】完善环境变量类型检查
  const envCheck = validateEnvironment();
  if (!envCheck.valid) {
    event.respondWith(new Response(
      `Error: ${envCheck.error}\n\n` +
      `Missing variables: ${envCheck.missing.join(', ')}\n\n` +
      `Please set these variables in Cloudflare Dashboard:\n` +
      `Workers & Pages → Your Worker → Settings → Variables`,
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    ));
    return;
  }

  const url = new URL(event.request.url);
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event, url));
  } else if (url.pathname === '/registerWebhook') {
    event.respondWith(handleWebhookManagement(event.request, () => registerWebhook(event, url, WEBHOOK, SECRET)));
  } else if (url.pathname === '/unRegisterWebhook') {
    event.respondWith(handleWebhookManagement(event.request, () => unRegisterWebhook(event)));
  } else if (url.pathname === '/verify') {
    event.respondWith(handleVerifyPage(event.request));
  } else if (url.pathname === '/verify-callback') {
    event.respondWith(handleVerifyCallback(event.request));
  } else {
    event.respondWith(new Response('No handler for this request'));
  }
});

async function handleWebhookManagement(request, action) {
  const managementSecret = request.headers.get(MANAGEMENT_HEADER) || '';
  if (request.method !== 'POST' || !constantTimeCompare(managementSecret, SECRET)) {
    return new Response('Forbidden', { status: 403 });
  }
  return action();
}

async function handleWebhook(event, url) {
  // 【安全加固】校验 Telegram Webhook secret_token 头部，防止伪造请求
  // 该头由 Telegram 在 setWebhook 时配置，由 registerWebhook 写入
  const incomingSecret = event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!SECRET || !constantTimeCompare(incomingSecret, SECRET)) {
    Logger.warn('webhook_secret_mismatch', {
      hasHeader: !!incomingSecret,
      ip: event.request.headers.get('CF-Connecting-IP') || 'unknown'
    });
    return new Response('Forbidden', { status: 403 });
  }

  const update = await event.request.json();
  event.waitUntil(onUpdate(update, url.origin));
  return new Response('Ok');
}

// 【引用片段】当回复者选中部分文字引用时，Telegram 在 message.quote 中带上
// { text, entities, position }。将其透传到 reply_parameters，让对方也只看到被引用的片段，
// 而非整条消息。未选中片段时 message.quote 不存在，返回空对象即可。
function buildReplyQuoteParams(message) {
  const quote = message && message.quote;
  if (!quote || typeof quote.text !== 'string') return {};
  const params = { quote: quote.text };
  if (Array.isArray(quote.entities) && quote.entities.length) {
    params.quote_entities = quote.entities;
  }
  if (typeof quote.position === 'number') {
    params.quote_position = quote.position;
  }
  return params;
}

async function onUpdate(update, origin) {
  // 访客屏蔽/取消屏蔽机器人（my_chat_member）：在其他分支之前处理，内部只认私聊
  if ('my_chat_member' in update) {
    return handleMyChatMember(update.my_chat_member);
  }

  if ('callback_query' in update) {
    const callbackQuery = update.callback_query;
    const userId = String(callbackQuery.from.id);

    // 处理本地题库验证回调（普通用户）
    if (callbackQuery.data && callbackQuery.data.startsWith('quiz_answer:')) {
      return handleQuizCallback(callbackQuery);
    }

    // 语言切换回调（访客和管理员均可）
    if (callbackQuery.data && (callbackQuery.data.startsWith('lang_set:') || callbackQuery.data === 'submenu_language' || callbackQuery.data === 'lang_menu')) {
      return handleLanguageCallback(callbackQuery);
    }

    // 处理验证模式切换回调（管理员）
    if (isAdmin(userId) && callbackQuery.data && callbackQuery.data.startsWith('verify_mode:')) {
      return handleVerifyModeCallback(callbackQuery);
    }

    // 处理回调查询（管理面板按钮）
    if (isAdmin(userId)) {
      return handleAdminCallback(callbackQuery);
    }
  } else if ('message_reaction' in update) {
    await handleMessageReaction(update.message_reaction);
  } else if ('message' in update) {
    await onMessage(update.message, origin);
  } else if ('edited_message' in update) {
    await onEditedMessage(update.edited_message, origin);
  }
}

async function onMessage(message, origin) {
  const chatId = message.chat.id.toString();
  const senderId = message.from ? String(message.from.id) : null;
  const isGroupAdminChat = GROUP_ID && chatId === GROUP_ID;
  const isInTopic = message.message_thread_id && isGroupAdminChat;

  // 缓存用户资料（从消息中）
  if (message.from) {
    await upsertUserProfileFromUpdate(message.from);
  }

  if (isGroupAdminChat && message.message_thread_id) {
    if (message.forum_topic_closed) {
      await updateThreadClosedStatus(message.message_thread_id, true);
      Logger.info('forum_topic_closed_recorded', { threadId: message.message_thread_id });
      return;
    }
    if (message.forum_topic_reopened) {
      await updateThreadClosedStatus(message.message_thread_id, false);
      Logger.info('forum_topic_reopened_recorded', { threadId: message.message_thread_id });
      return;
    }
  }

  // 1. 如果是管理员发消息
  if (isAdmin(chatId) || (isGroupAdminChat && senderId && isAdmin(senderId))) {
    return handleAdminMessage(message);
  }

  // 2. 如果是访客 (普通用户)
  else {
    const text = (message.text || '').trim();
    const guestLang = await getUserLang(chatId);
    const guestCmd = text.split(' ')[0].split('@')[0].toLowerCase();

    // /language 与 /lang 对访客开放（在命令拦截之前处理）
    if (guestCmd === '/language' || guestCmd === '/lang') {
      return sendLanguageMenu(chatId, chatId);
    }

    // 【话题模式】如果在话题中收到消息，说明用户已经在话题内，不需要验证
    // 这可能是用户在 General 话题或其他话题中发送的消息
    if (isInTopic) {
      Logger.debug('message_in_topic_ignored', {
        userId: chatId,
        threadId: message.message_thread_id,
        text: text ? text.substring(0, 50) : '[media]'
      });
      return; // 忽略话题中的消息，不触发验证
    }

    // 【防骚扰】拦截普通用户发送的指令（除 /start 与 /language 外，后者已在上方处理）
    if (text.startsWith('/') && text !== '/start') {
      // 静默拦截，不返回任何提示
      Logger.debug('user_command_blocked', { userId: chatId, command: text.split(' ')[0] });
      return;
    }

    // 0. 检查白名单（白名单用户跳过所有检查）
    const whitelisted = await isWhitelisted(chatId);
    if (whitelisted) {
      // 白名单用户处理 /start 或直接转发
      if (text === '/start') {
        return sendMessage({
          chat_id: chatId,
          text: t(guestLang, 'guest_welcome_whitelisted'),
          reply_markup: guestLanguageKeyboard(guestLang)
        });
      }
      return handleGuestMessage(message);
    }

    // 处理 /start 命令
    if (text === '/start') {
      // 检查是否已验证
      const isVerified = await isUserVerified(chatId);
      if (isVerified) {
        return sendMessage({
          chat_id: chatId,
          text: t(guestLang, 'guest_welcome_verified'),
          reply_markup: guestLanguageKeyboard(guestLang)
        });
      } else {
        // 未验证，进入验证流程
        return handleVerification(message, chatId, origin);
      }
    }

    // 0. 检查联合封禁（如果开启）
    const unionBanEnabled = await getConfig(CONFIG_KEYS.UNION_BAN, '0');
    if (unionBanEnabled === '1' || unionBanEnabled === 'true') {
      const isUnionBanned = await checkUnionBan(chatId);
      if (isUnionBanned) {
        return sendMessage({
          chat_id: chatId,
          text: t(guestLang, 'guest_union_banned'),
          parse_mode: 'HTML'
        });
      }
    }

    // 1. 检查欺诈数据库
    const isFraud = await checkFraud(chatId);
    if (isFraud) {
      // 通知管理员（使用接收管理员自己的语言）
      if (ADMIN_UID) {
        const fraudAdminLang = await getUserLang(ADMIN_UID);
        await sendMessage({
          chat_id: ADMIN_UID,
          text: t(fraudAdminLang, 'admin_fraud_detected', { uid: chatId }),
          parse_mode: 'HTML'
        });
      }
      return sendMessage({
        chat_id: chatId,
        text: t(guestLang, 'guest_fraud_blocked'),
        parse_mode: 'HTML'
      });
    }

    // 2. 检查本地黑名单（带 L1 缓存，热路径性能优化）
    const isBlocked = await isBlockedCached(chatId);
    if (isBlocked) {
      // 被拉黑了，回复提示
      return sendMessage({
        chat_id: chatId,
        text: t(guestLang, 'guest_blocked')
      });
    }

    // 3. 检查是否已通过验证（优先使用内存缓存）
    const isVerified = await isUserVerified(chatId);

    if (isVerified) {
      // 4. 检查垃圾消息过滤
      const spamCheck = await checkSpam(message, chatId);
      if (spamCheck.isSpam) {
        // 【话题模式】如果在话题中发送屏蔽词，静默转发到垃圾话题，但在话题中提示用户
        if (isInTopic) {
          Logger.debug('spam_in_topic_silenced', {
            userId: chatId,
            threadId: message.message_thread_id,
            reason: spamCheck.reason
          });
          // 如果启用了垃圾话题，静默转发
          const spamTopicEnabled = await isSpamTopicEnabled();
          const spamTopicConfig = await getSpamTopicConfig();
          if (spamTopicEnabled && spamTopicConfig.topicId && GROUP_ID) {
            await silentlyForwardSpamMessage(message, GROUP_ID, spamTopicConfig.topicId);
          }
          // 【话题模式】在话题中提示用户
          return sendMessage({
            chat_id: GROUP_ID,
            message_thread_id: message.message_thread_id,
            text: t(guestLang, 'guest_spam_blocked')
          });
        }

        // 检查垃圾话题功能是否启用
        const spamTopicEnabled = await isSpamTopicEnabled();
        const spamTopicConfig = await getSpamTopicConfig();

        if (spamTopicEnabled && spamTopicConfig.topicId && GROUP_ID) {
          // 静默转发到垃圾话题
          const forwarded = await silentlyForwardSpamMessage(message, GROUP_ID, spamTopicConfig.topicId);
          if (forwarded) {
            // 用户无感知，不返回错误消息
            return sendMessage({
              chat_id: chatId,
              text: t(guestLang, 'guest_spam_fake_sent')  // 假装成功发送
            });
          }
        }

        // 传统模式：拦截并通知管理员
        // 记录垃圾消息
        if (ADMIN_UID) {
          const spamAdminLang = await getUserLang(ADMIN_UID);
          await sendMessage({
            chat_id: ADMIN_UID,
            text: t(spamAdminLang, 'admin_spam_intercepted', { uid: chatId, reason: formatSpamReason(spamAdminLang, spamCheck) }),
            parse_mode: 'HTML'
          });
        }
        return sendMessage({
          chat_id: chatId,
          text: t(guestLang, 'guest_spam_blocked')
        });
      }

      // 5. 检查防刷屏限制（精细化速率限制）
      const rateLimit = checkRateLimit(chatId, 'message');
      if (!rateLimit.allowed) {
        return sendMessage({
          chat_id: chatId,
          text: t(guestLang, 'guest_rate_limited', { seconds: rateLimit.retryAfter })
        });
      }

      // 已验证，发送自动回复（如果设置了）
      const autoReplyMsg = await getConfig(CONFIG_KEYS.AUTO_REPLY_MSG);
      if (autoReplyMsg) {
        const autoReplyKey = `autoreply:${chatId}`;
        const lastReply = await cacheApiGet(autoReplyKey) || await KV.get(autoReplyKey);

        if (!lastReply) {
          await sendMessage({
            chat_id: chatId,
            text: autoReplyMsg
          });
          await KV.put(autoReplyKey, '1', { expirationTtl: 600 });
          await cacheApiSet(autoReplyKey, '1', 600);
        }
      }
      // 正常转发给管理员
      return handleGuestMessage(message);
    } else {
      // 未验证，进入验证流程
      return handleVerification(message, chatId, origin);
    }
  }
}

// 处理编辑后的消息
async function onEditedMessage(message, origin) {
  const chatId = message.chat.id.toString();
  const senderId = message.from ? String(message.from.id) : null;
  const isGroupAdminChat = GROUP_ID && chatId === GROUP_ID;

  // 1. 如果是管理员发消息（编辑回复）
  if (isAdmin(chatId) || (isGroupAdminChat && senderId && isAdmin(senderId))) {
    return handleAdminEditedMessage(message);
  }

  // 2. 如果是访客 (普通用户) 编辑消息
  else {
    // 0. 检查白名单（白名单用户跳过所有检查）
    const whitelisted = await isWhitelisted(chatId);
    if (whitelisted) {
      // 白名单用户直接处理编辑
      return handleGuestEditedMessage(message);
    }

    const isBlocked = await isBlockedCached(chatId);
    if (isBlocked) {
      return;
    }

    // 2. 检查是否已通过验证（优先使用内存缓存）
    const isVerified = await isUserVerified(chatId);

    if (isVerified) {
      // 已验证，转发编辑后的消息
      return handleGuestEditedMessage(message);
    } else {
      // 未验证，忽略编辑
      return;
    }
  }
}

// 辅助函数：尝试从回复或参数中获取目标 ID
async function getTargetId(message, commandName) {
  const text = (message.text || '').trim();
  const args = text.split(/\s+/);
  const reply = message.reply_to_message;
  const contextChatId = message.chat?.id ? String(message.chat.id) : null;

  // 【话题模式支持】如果消息来自话题，直接从话题 ID 获取用户 UID
  if (contextChatId === GROUP_ID && message.message_thread_id) {
    const threadId = message.message_thread_id;
    const userId = await KV.get(`thread:${threadId}`);
    if (userId) {
      Logger.info('get_target_id_from_topic', { commandName, threadId, userId });
      return userId;
    }
  }

  // 优先 1：从回复的消息中提取
  if (reply && (reply.forward_from || reply.forward_sender_name)) {
    const guestChatId = await KV.get(`msg-map-${contextChatId}:${reply.message_id}`)
      || await KV.get('msg-map-' + reply.message_id);
    if (guestChatId) return guestChatId;
  }

  // 优先 2：从指令参数中提取 (例如 /unblock 123456)
  if (args.length > 1) {
    const potentialId = args[1];
    // 简单的数字校验
    if (/^\d+$/.test(potentialId)) {
      return potentialId;
    }
  }

  return null;
}

// 获取已验证用户列表（支持分页和过滤）
async function getVerifiedUsersPaged(page = 1, pageSize = 10, filter = 'all') {
  // 获取所有已验证用户（会自动处理新旧版本迁移）
  const allUsers = await getAllVerifiedUsers();

  if (!allUsers || allUsers.length === 0) {
    return { users: [], total: 0, totalPages: 0 };
  }

  try {
    // 获取每个用户的详细信息并过滤
    const userDetails = [];
    for (const [userId, userName] of allUsers) {
      const [blocked, whitelisted] = await Promise.all([
        isBlockedCached(userId),
        isWhitelisted(userId)
      ]);

      const user = {
        id: userId,
        name: userName || 'Unknown',
        blocked: !!blocked,
        whitelisted: !!whitelisted
      };

      // 应用过滤
      if (filter === 'whitelisted' && !user.whitelisted) continue;
      if (filter === 'blocked' && !user.blocked) continue;

      userDetails.push(user);
    }

    const total = userDetails.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 确保页码有效
    page = Math.max(1, Math.min(page, totalPages));

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const users = userDetails.slice(start, end);

    return {
      users,
      total,
      page,
      totalPages,
      pageSize
    };
  } catch (e) {
    Logger.error('get_user_list_failed', e);
    return { users: [], total: 0, totalPages: 0 };
  }
}

// 生成主菜单
async function generateMainMenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const welcomeMsg = await getConfig(CONFIG_KEYS.WELCOME_MSG);
  const autoReplyMsg = await getConfig(CONFIG_KEYS.AUTO_REPLY_MSG);
  const unionBanEnabled = await getConfig(CONFIG_KEYS.UNION_BAN, '0');
  const verifyMode = await getVerifyMode();
  const spamFilterEnabled = await getSpamFilterEnabled();
  const aiConfig = await getAISpamDetectionConfig();
  const forwardMode = await getForwardMode();
  const onOff = (v) => v ? `🟢 ${t(L, 'on')}` : `🔴 ${t(L, 'off')}`;
  const setNot = (v) => v ? `🟢 ${t(L, 'set')}` : `🔴 ${t(L, 'not_set')}`;
  const unionOn = (unionBanEnabled === '1' || unionBanEnabled === 'true');
  const forwardLabel = forwardMode === FORWARD_MODES.TOPIC ? t(L, 'menu_forward_topic') : t(L, 'menu_forward_direct');
  const text = `${t(L, 'menu_title')}\n\n${t(L, 'menu_current_config')}\n🔐 ${t(L, 'menu_verify_mode', { mode: getVerifyModeName(verifyMode, L) })}\n🧹 ${t(L, 'menu_spam_filter', { status: onOff(spamFilterEnabled) })}\n🪄 ${t(L, 'menu_ai_detection', { status: onOff(aiConfig.enabled) })}\n🌐 ${t(L, 'menu_union_ban', { status: onOff(unionOn) })}\n👋 ${t(L, 'menu_welcome_msg', { status: setNot(!!welcomeMsg) })}\n✉️ ${t(L, 'menu_auto_reply', { status: setNot(!!autoReplyMsg) })}\n💬 ${t(L, 'menu_forward_mode', { mode: forwardLabel })}\n\n${t(L, 'menu_tap_below')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: t(L, 'btn_verify_mode'), callback_data: 'submenu_verify' }, { text: t(L, 'btn_spam_filter'), callback_data: 'submenu_spam' }],
      [{ text: t(L, 'btn_ai_detection'), callback_data: 'submenu_ai' }, { text: t(L, 'btn_spam_topic'), callback_data: 'submenu_spamtopic' }],
      [{ text: t(L, 'btn_union_ban'), callback_data: 'submenu_union' }, { text: t(L, 'btn_users'), callback_data: 'submenu_users' }],
      [{ text: t(L, 'btn_welcome'), callback_data: 'submenu_welcome' }, { text: t(L, 'btn_autoreply'), callback_data: 'submenu_autoreply' }],
      [{ text: t(L, 'btn_forward_mode'), callback_data: 'submenu_forward' }, { text: t(L, 'btn_stats'), callback_data: 'submenu_stats' }],
      [{ text: t(L, 'btn_language'), callback_data: 'submenu_language' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成垃圾过滤子菜单
async function generateSpamFilterSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const enabled = await getSpamFilterEnabled();
  const rules = await getSpamFilterRules();
  const status = enabled ? t(L, 'status_on_icon') : t(L, 'status_off_icon');
  const text = `${t(L, 'spam_title')}\n\n${t(L, 'spam_status', { status })}\n\n${t(L, 'spam_current_rules')}\n${formatSpamRules(rules, L)}\n\n${t(L, 'spam_quick_actions')}\n\n${t(L, 'spam_multiline_note')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: enabled ? t(L, 'btn_spam_off') : t(L, 'btn_spam_on'), callback_data: 'toggle_spam_filter' }],
      [{ text: t(L, 'btn_manage_keywords'), callback_data: 'manage_keywords' }],
      [{ text: t(L, 'btn_reset_rules'), callback_data: 'reset_spam_rules' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成关键词管理子菜单
async function generateKeywordManagementSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const rules = await getSpamFilterRules();
  const keywords = rules.keywords || [];
  const allowKeywords = rules.allowKeywords || [];
  const regexes = rules.regexes || [];
  const allowRegexes = rules.allowRegexes || [];
  const text = `${t(L, 'kw_title')}\n\n${t(L, 'kw_block_keywords', { count: keywords.length })}\n${formatKeywordList(keywords, 10, L)}\n\n${t(L, 'kw_allow_keywords', { count: allowKeywords.length })}\n${formatKeywordList(allowKeywords, 5, L)}\n\n${t(L, 'kw_block_regex', { count: regexes.length })}\n${formatKeywordList(regexes, 3, L)}\n\n${t(L, 'kw_allow_regex', { count: allowRegexes.length })}\n${formatKeywordList(allowRegexes, 3, L)}\n\n${t(L, 'kw_howto')}\n\n${t(L, 'kw_note')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: t(L, 'btn_view_all_keywords'), callback_data: 'view_all_keywords' }],
      [{ text: t(L, 'btn_clear_keywords'), callback_data: 'clear_keywords' }],
      [{ text: t(L, 'btn_reset_rules'), callback_data: 'reset_spam_rules' }],
      [{ text: t(L, 'btn_back_spam'), callback_data: 'back_to_spam_filter' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 格式化关键词列表（用于显示）
function formatKeywordList(keywords, maxDisplay = 10, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  if (!keywords || keywords.length === 0) {
    return t(L, 'keyword_empty');
  }
  const display = keywords.slice(0, maxDisplay);
  const text = display.map(k => `• <code>${escapeHtml(k)}</code>`).join('\n');
  if (keywords.length > maxDisplay) {
    return text + `\n${t(L, 'keyword_more', { count: keywords.length - maxDisplay })}`;
  }
  return text;
}


// 生成 AI 检测设置子菜单
async function generateAISpamSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const aiConfig = await getAISpamDetectionConfig();
  const rateLimit = await checkAIRateLimit();
  const status = aiConfig.enabled ? t(L, 'status_on_icon') : t(L, 'status_off_icon');
  const lines = [
    t(L, 'ai_title'), '',
    t(L, 'ai_status', { status }), '',
    t(L, 'ai_config_title'),
    `• ${t(L, 'ai_threshold', { value: aiConfig.confidenceThreshold || 0.7 })}`,
    `• ${t(L, 'ai_hourly_limit', { limit: CONFIG.AI_RATE_LIMIT_PER_HOUR })}`,
    `• ${t(L, 'ai_remaining', { remaining: rateLimit.remaining })}`
  ];
  if (!rateLimit.allowed) lines.push(`• ${t(L, 'ai_reset_in', { seconds: rateLimit.resetAfter })}`);
  lines.push('', t(L, 'ai_howto'), '', t(L, 'ai_env_title'), '<code>CF_ACCOUNT_ID</code> - Cloudflare Account ID', '<code>CF_AI_TOKEN</code> - Cloudflare AI API Token', '', t(L, 'ai_tip'));
  const text = lines.join('\n');
  const keyboard = {
    inline_keyboard: [
      [{ text: aiConfig.enabled ? t(L, 'btn_ai_off') : t(L, 'btn_ai_on'), callback_data: 'toggle_ai_detection' }],
      [{ text: t(L, 'btn_ai_confidence'), callback_data: 'ai_confidence' }],
      [{ text: t(L, 'btn_ai_stats'), callback_data: 'ai_stats' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成垃圾话题设置子菜单
async function generateSpamTopicSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const config = await getSpamTopicConfig();
  const spamFilterEnabled = await getSpamFilterEnabled();
  const aiEnabled = await isAISpamDetectionEnabled();
  const status = config.enabled ? t(L, 'status_on_icon') : t(L, 'status_off_icon');
  const text = `${t(L, 'st_title')}\n\n${t(L, 'st_status', { status })}\n\n${t(L, 'st_config_title')}\n• ${t(L, 'st_topic_id', { id: config.topicId || t(L, 'st_not_set') })}\n• ${t(L, 'st_auto_create', { icon: config.autoCreate ? '✅' : '❌' })}\n• ${t(L, 'st_notify_admin', { icon: config.notifyAdmin ? '✅' : '❌' })}\n\n${t(L, 'st_related_title')}\n• ${t(L, 'st_related_spam', { icon: spamFilterEnabled ? '🟢' : '🔴' })}\n• ${t(L, 'st_related_ai', { icon: aiEnabled ? '🟢' : '🔴' })}\n\n${t(L, 'st_howto')}\n\n${t(L, 'st_steps')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: config.enabled ? t(L, 'btn_st_off') : t(L, 'btn_st_on'), callback_data: 'toggle_spam_topic' }],
      [{ text: t(L, 'btn_st_create'), callback_data: 'create_spam_topic' }],
      [{ text: t(L, 'btn_st_config_id'), callback_data: 'config_spam_topic_id' }],
      [{ text: t(L, 'btn_st_view'), callback_data: 'view_spam_messages' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


async function generateForwardModeSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const mode = await getForwardMode();
  const issues = [];
  if (!GROUP_ID) issues.push(t(L, 'fwd_issue_group'));
  if (!ADMIN_UID) issues.push(t(L, 'fwd_issue_admin'));
  const modeLabel = mode === FORWARD_MODES.TOPIC ? t(L, 'fwd_mode_topic_label') : t(L, 'fwd_mode_direct_label');
  const readiness = issues.length ? `${t(L, 'fwd_prereq_title')}\n${issues.join('\n')}` : t(L, 'fwd_ready');
  const text = `${t(L, 'fwd_title')}\n\n${t(L, 'fwd_current', { mode: modeLabel })}\n\n${t(L, 'fwd_desc')}\n\n${readiness}\n\n${t(L, 'fwd_note')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: (mode === FORWARD_MODES.DIRECT ? '✅ ' : '') + t(L, 'btn_fwd_direct'), callback_data: 'forward_mode:direct' }],
      [{ text: (mode === FORWARD_MODES.TOPIC ? '✅ ' : '') + t(L, 'btn_fwd_topic'), callback_data: 'forward_mode:topic' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成验证模式子菜单
async function generateVerifySubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const currentMode = await getVerifyMode();
  const turnstileAvailable = hasTurnstileConfigured();
  let text = `${t(L, 'verify_title')}\n\n${t(L, 'verify_current', { mode: getVerifyModeName(currentMode, L) })}\n\n${t(L, 'verify_options_title')}\n${t(L, 'verify_options_block')}\n`;
  if (!turnstileAvailable) {
    text += `\n${t(L, 'verify_turnstile_missing')}`;
  }
  const keyboard = {
    inline_keyboard: [
      [{ text: (currentMode === 'local_quiz' ? '✅ ' : '') + t(L, 'mode_local_quiz'), callback_data: 'verify_mode:local_quiz' }],
      [{ text: (currentMode === 'turnstile' ? '✅ ' : '') + t(L, 'mode_turnstile'), callback_data: 'verify_mode:turnstile' }],
      [{ text: (currentMode === 'both' ? '✅ ' : '') + t(L, 'mode_both'), callback_data: 'verify_mode:both' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成联合封禁子菜单
async function generateUnionBanSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const unionBanEnabled = await getConfig(CONFIG_KEYS.UNION_BAN, '0');
  const isEnabled = unionBanEnabled === '1' || unionBanEnabled === 'true';
  const status = isEnabled ? t(L, 'status_on_icon') : t(L, 'status_off_icon');
  const text = `${t(L, 'union_title')}\n\n${t(L, 'union_status', { status })}\n\n${t(L, 'union_desc')}\n\n${t(L, 'union_tap')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: isEnabled ? t(L, 'btn_union_off') : t(L, 'btn_union_on'), callback_data: 'toggle_union' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成欢迎消息子菜单
async function generateWelcomeSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const current = await getConfig(CONFIG_KEYS.WELCOME_MSG);
  const currentText = current ? escapeHtml(current) : t(L, 'welcome_not_set');
  const text = `${t(L, 'welcome_title')}\n\n${t(L, 'welcome_current')}\n<pre>${currentText}</pre>\n\n${t(L, 'welcome_howto')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: t(L, 'btn_refresh'), callback_data: 'refresh_welcome' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成自动回复子菜单
async function generateAutoreplySubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const current = await getConfig(CONFIG_KEYS.AUTO_REPLY_MSG);
  const currentText = current ? escapeHtml(current) : t(L, 'autoreply_not_set');
  const text = `${t(L, 'autoreply_title')}\n\n${t(L, 'autoreply_current')}\n<pre>${currentText}</pre>\n\n${t(L, 'autoreply_howto')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: t(L, 'btn_refresh'), callback_data: 'refresh_autoreply' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成统计信息子菜单
async function generateStatsSubmenu(lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const stats = await getStats();
  const today = new Date().toISOString().split('T')[0];
  const text = `${t(L, 'stats_title')}\n\n${t(L, 'stats_today', { date: today })}\n• ${t(L, 'stats_today_messages', { count: stats.todayMessages })}\n• ${t(L, 'stats_today_active', { count: stats.todayActiveUsers })}\n\n${t(L, 'stats_total_title')}\n• ${t(L, 'stats_total_messages', { count: stats.totalMessages })}\n\n${t(L, 'stats_note')}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: t(L, 'btn_refresh'), callback_data: 'refresh_stats' }],
      [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
    ]
  };
  return { text, reply_markup: keyboard };
}


// 生成用户管理子菜单
async function generateUsersSubmenu(page = 1, filter = 'all', lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const result = await getVerifiedUsersPaged(page, 10, filter);
  const stats = await getUserStats();
  const filterLabel = { all: t(L, 'filter_all'), whitelisted: t(L, 'filter_whitelisted'), blocked: t(L, 'filter_blocked') }[filter] || '';
  const summary = t(L, 'users_summary', { total: stats.total, whitelisted: stats.whitelisted, blocked: stats.blocked });
  const makeFilterButtons = () => [
    { text: (filter === 'all' ? '✅ ' : '') + t(L, 'filter_all_short'), callback_data: 'users_filter:all' },
    { text: (filter === 'whitelisted' ? '✅ ' : '') + t(L, 'filter_whitelisted_short'), callback_data: 'users_filter:whitelisted' },
    { text: (filter === 'blocked' ? '✅ ' : '') + t(L, 'filter_blocked_short'), callback_data: 'users_filter:blocked' }
  ];
  if (result.total === 0) {
    const text = `${t(L, 'users_title')} · ${filterLabel}\n\n${summary}\n\n${t(L, 'users_empty')}`;
    return {
      text,
      reply_markup: {
        inline_keyboard: [
          makeFilterButtons(),
          [{ text: t(L, 'btn_refresh'), callback_data: `refresh_users:${page}:${filter}` }],
          [{ text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }]
        ]
      }
    };
  }
  let userList = '';
  const userButtons = [];
  let idx = (page - 1) * 10 + 1;
  for (const user of result.users) {
    const status = user.blocked ? '🚫' : (user.whitelisted ? '⭐' : '•');
    const profile = await getUserProfile(user.id);
    let displayName = '';
    let usernameStr = '';
    if (profile) {
      displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      if (!displayName) displayName = profile.username || '';
      if (profile.username && displayName !== profile.username) usernameStr = `@${profile.username}`;
    } else if (user.name && user.name !== 'Unknown') {
      displayName = user.name;
    }
    if (!displayName) displayName = user.id;
    let line = `${idx}. ${status} <b>${escapeHtml(displayName)}</b>`;
    if (usernameStr) line += `  ${escapeHtml(usernameStr)}`;
    line += `\n   UID: <code>${user.id}</code>`;
    if (user.whitelisted) line += ` · ${t(L, 'users_trusted_tag')}`;
    if (user.blocked) line += ` · ${t(L, 'users_blocked_tag')}`;
    line += '\n';
    userList += line;
    let btnIcon = '';
    if (user.whitelisted) btnIcon = '⭐';
    if (user.blocked) btnIcon = '🚫';
    userButtons.push({
      text: `${idx}${btnIcon}`,
      callback_data: `user_menu:${user.id}:${page}:${filter}`
    });
    idx++;
  }
  const userButtonRows = [];
  for (let i = 0; i < userButtons.length; i += 5) {
    userButtonRows.push(userButtons.slice(i, i + 5));
  }
  const text = `${t(L, 'users_title')} · ${filterLabel}\n\n${summary}  ${t(L, 'users_page_info', { page: result.page, totalPages: result.totalPages })}\n\n${userList}\n${t(L, 'users_hint')}`;
  const paginationButtons = [];
  if (result.page > 1) {
    paginationButtons.push({ text: t(L, 'btn_prev_page'), callback_data: `users_page:${result.page - 1}:${filter}` });
  }
  if (result.page < result.totalPages) {
    paginationButtons.push({ text: t(L, 'btn_next_page'), callback_data: `users_page:${result.page + 1}:${filter}` });
  }
  const keyboardRows = [makeFilterButtons()];
  if (paginationButtons.length) keyboardRows.push(paginationButtons);
  keyboardRows.push(...userButtonRows);
  keyboardRows.push([
    { text: t(L, 'btn_refresh'), callback_data: `refresh_users:${result.page}:${filter}` },
    { text: t(L, 'btn_back_main'), callback_data: 'back_to_main' }
  ]);
  return { text, reply_markup: { inline_keyboard: keyboardRows } };
}


// 生成单个用户的操作子菜单
async function generateUserActionSubmenu(userId, page, filter, lang) {
  const L = normalizeLang(lang) || getDefaultLang();
  const [whitelisted, blocked, profile] = await Promise.all([
    isWhitelisted(userId),
    isBlockedCached(userId),
    getUserProfile(userId)
  ]);
  let displayName = '';
  let usernameStr = '';
  if (profile) {
    displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    if (!displayName) displayName = profile.username || '';
    if (profile.username && displayName !== profile.username) usernameStr = `@${profile.username}`;
  }
  if (!displayName) displayName = userId;
  const statusIcon = blocked ? '🚫' : (whitelisted ? '⭐' : '👤');
  const statusText = blocked ? t(L, 'user_status_blocked') : (whitelisted ? t(L, 'user_status_trusted') : t(L, 'user_status_normal'));
  let text = `👤 <b>${escapeHtml(displayName)}</b>\n═══════════════\n\n${t(L, 'user_uid_line', { uid: userId })}`;
  if (usernameStr) text += `\n🏷️ ${escapeHtml(usernameStr)}`;
  text += `\n${t(L, 'user_status_line', { icon: statusIcon, status: statusText })}\n\n${t(L, 'user_choose_action')}`;
  const actionButtons = [];
  if (whitelisted) {
    actionButtons.push({ text: t(L, 'btn_untrust'), callback_data: `user_untrust:${userId}:${page}:${filter}` });
  } else {
    actionButtons.push({ text: t(L, 'btn_trust'), callback_data: `user_trust:${userId}:${page}:${filter}` });
  }
  if (blocked) {
    actionButtons.push({ text: t(L, 'btn_unblock'), callback_data: `user_unblock:${userId}:${page}:${filter}` });
  } else {
    actionButtons.push({ text: t(L, 'btn_block'), callback_data: `user_block:${userId}:${page}:${filter}` });
  }
  return {
    text,
    reply_markup: {
      inline_keyboard: [
        actionButtons,
        [{ text: t(L, 'btn_back_users'), callback_data: `users_page:${page}:${filter}` }]
      ]
    }
  };
}


// 获取用户统计
async function getUserStats() {
  const keys = await KV.list({ prefix: 'verified-' });
  let total = 0;
  let whitelisted = 0;
  let blocked = 0;

  for (const key of keys.keys) {
    const userId = key.name.replace('verified-', '');
    total++;

    const isWhite = await isWhitelisted(userId);
    if (isWhite) whitelisted++;

    const isBlocked = await isBlockedCached(userId);
    if (isBlocked) blocked++;
  }

  return { total, whitelisted, blocked };
}

// 处理管理员回调
async function handleAdminCallback(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const adminChatId = String(callbackQuery.from.id); // 使用回调用户的 ID
  const lang = await getUserLang(adminChatId);

  // 空操作（页码显示按钮等）
  if (data === 'noop') {
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 新用户卡片快捷操作（⭐ 信任 / 🚫 封禁；私聊与群组话题里点击均可）
  if (data.startsWith('newuser_trust:') || data.startsWith('newuser_ban:')) {
    const targetId = data.split(':')[1];
    if (data.startsWith('newuser_trust:')) {
      await addToWhitelist(targetId);
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_newuser_trusted', { userId: targetId })
      });
    }
    await KV.put('blocked-' + targetId, 'true');
    await invalidateBlockedCache(targetId);
    await removeVerifiedUser(targetId);
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_newuser_banned', { userId: targetId })
    });
  }

  // 返回主菜单
  if (data === 'back_to_main') {
    const menu = await generateMainMenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'back_to_ai_menu') {
    const menu = await generateAISpamSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 主菜单 - 进入子菜单
  if (data === 'submenu_verify') {
    const menu = await generateVerifySubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_spam') {
    const menu = await generateSpamFilterSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 关键词管理 - 进入子菜单
  if (data === 'manage_keywords') {
    const menu = await generateKeywordManagementSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 关键词管理 - 查看完整列表
  if (data === 'view_all_keywords') {
    const rules = await getSpamFilterRules();
    const allKeywords = [
      t(lang, 'kw_section_block'),
      ...(rules.keywords || []),
      '',
      t(lang, 'kw_section_allow'),
      ...(rules.allowKeywords || []),
      '',
      t(lang, 'kw_section_block_re'),
      ...(rules.regexes || []),
      '',
      t(lang, 'kw_section_allow_re'),
      ...(rules.allowRegexes || [])
    ].join('\n');

    await requestTelegram('sendMessage', {
      chat_id: chatId,
      ...(callbackQuery.message.message_thread_id ? { message_thread_id: callbackQuery.message.message_thread_id } : {}),
      text: `${t(lang, 'kw_list_title')}\n<pre>${escapeHtml(allKeywords)}</pre>`,
      parse_mode: 'HTML'
    });

    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 关键词管理 - 清空拦截词
  if (data === 'clear_keywords') {
    const rules = await getSpamFilterRules();
    rules.keywords = [];
    rules.regexes = [];
    await setSpamFilterRules(rules);

    const menu = await generateKeywordManagementSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });

    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_keywords_cleared')
    });
  }

  // 关键词管理 - 返回过滤设置
  if (data === 'back_to_spam_filter') {
    const menu = await generateSpamFilterSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_ai') {
    const menu = await generateAISpamSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_spamtopic') {
    const menu = await generateSpamTopicSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_union') {
    const menu = await generateUnionBanSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_welcome') {
    const menu = await generateWelcomeSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_autoreply') {
    const menu = await generateAutoreplySubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data.startsWith('forward_mode:')) {
    const mode = data.split(':')[1];
    if (mode === FORWARD_MODES.TOPIC && !hasTopicForwardingPrerequisites()) {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_fwd_need_config'),
        show_alert: true
      });
    }

    if (mode === FORWARD_MODES.TOPIC) {
      const readiness = await verifyTopicEnvironment({ force: true, notifyOnFailure: false });
      if (!readiness.ok) {
        return requestTelegram('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: t(lang, 'toast_fwd_topic_unavailable', { issue: describeTopicEnvIssue(readiness, lang) }),
          show_alert: true
        });
      }
    }

    const applied = await setForwardMode(mode === FORWARD_MODES.TOPIC ? FORWARD_MODES.TOPIC : FORWARD_MODES.DIRECT);
    const menu = await generateForwardModeSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: applied === FORWARD_MODES.TOPIC ? t(lang, 'toast_fwd_switched_topic') : t(lang, 'toast_fwd_switched_direct')
    });
  }

  if (data === 'submenu_forward') {
    const menu = await generateForwardModeSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  if (data === 'submenu_stats') {
    const menu = await generateStatsSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 用户管理 - 进入子菜单
  if (data === 'submenu_users') {
    const menu = await generateUsersSubmenu(1, 'all', lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 用户管理 - 翻页
  if (data.startsWith('users_page:')) {
    const parts = data.split(':');
    const page = parseInt(parts[1]) || 1;
    const filter = parts[2] || 'all';
    const menu = await generateUsersSubmenu(page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_page', { page }) });
  }

  // 用户管理 - 过滤切换
  if (data.startsWith('users_filter:')) {
    const filter = data.split(':')[1] || 'all';
    const menu = await generateUsersSubmenu(1, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    const filterText = { all: t(lang, 'filter_all_short'), whitelisted: t(lang, 'filter_whitelisted_short'), blocked: t(lang, 'filter_blocked_short') }[filter];
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_filter_switched', { filter: filterText }) });
  }

  // 用户管理 - 刷新
  if (data.startsWith('refresh_users:')) {
    const parts = data.split(':');
    const page = parseInt(parts[1]) || 1;
    const filter = parts[2] || 'all';
    const menu = await generateUsersSubmenu(page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_refreshed') });
  }

  // 用户管理 - 进入用户操作子菜单
  if (data.startsWith('user_menu:')) {
    const parts = data.split(':');
    const userId = parts[1];
    const page = parseInt(parts[2]) || 1;
    const filter = parts[3] || 'all';
    const menu = await generateUserActionSubmenu(userId, page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  }

  // 用户管理 - 信任用户
  if (data.startsWith('user_trust:')) {
    const parts = data.split(':');
    const userId = parts[1];
    const page = parseInt(parts[2]) || 1;
    const filter = parts[3] || 'all';
    await addToWhitelist(userId);
    const menu = await generateUsersSubmenu(page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_user_trusted', { userId }) });
  }

  // 用户管理 - 取消信任用户
  if (data.startsWith('user_untrust:')) {
    const parts = data.split(':');
    const userId = parts[1];
    const page = parseInt(parts[2]) || 1;
    const filter = parts[3] || 'all';
    await removeFromWhitelist(userId);
    const menu = await generateUsersSubmenu(page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_user_untrusted', { userId }) });
  }

  // 用户管理 - 拉黑用户
  if (data.startsWith('user_block:')) {
    const parts = data.split(':');
    const userId = parts[1];
    const page = parseInt(parts[2]) || 1;
    const filter = parts[3] || 'all';
    await KV.put('blocked-' + userId, 'true');
    await invalidateBlockedCache(userId);
    await removeVerifiedUser(userId);
    const menu = await generateUsersSubmenu(page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_user_blocked', { userId }) });
  }

  // 用户管理 - 解封用户
  if (data.startsWith('user_unblock:')) {
    const parts = data.split(':');
    const userId = parts[1];
    const page = parseInt(parts[2]) || 1;
    const filter = parts[3] || 'all';
    await KV.delete('blocked-' + userId);
    await invalidateBlockedCache(userId);
    const menu = await generateUsersSubmenu(page, filter, lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_user_unblocked', { userId }) });
  }

  // 垃圾过滤 - 切换状态
  if (data === 'toggle_spam_filter') {
    const isEnabled = await getSpamFilterEnabled();
    await setSpamFilterEnabled(!isEnabled);

    const menu = await generateSpamFilterSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: isEnabled ? t(lang, 'toast_spam_off') : t(lang, 'toast_spam_on')
    });
  }

  // 垃圾过滤 - 重置规则
  if (data === 'reset_spam_rules') {
    await resetSpamFilterRules();

    const menu = await generateSpamFilterSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_rules_reset')
    });
  }

  // AI 检测 - 切换状态
  if (data === 'toggle_ai_detection') {
    const aiConfig = await getAISpamDetectionConfig();
    await setAISpamDetectionConfig({
      enabled: !aiConfig.enabled,
      confidenceThreshold: aiConfig.confidenceThreshold || 0.7
    });

    const menu = await generateAISpamSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: !aiConfig.enabled ? t(lang, 'toast_ai_on') : t(lang, 'toast_ai_off')
    });
  }

  // AI 检测 - 查看使用统计
  if (data === 'ai_stats') {
    const now = Date.now();
    const rateLimit = await checkAIRateLimit();
    const used = CONFIG.AI_RATE_LIMIT_PER_HOUR - rateLimit.remaining;
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'ai_stats_alert', { used, limit: CONFIG.AI_RATE_LIMIT_PER_HOUR, remaining: rateLimit.remaining, reset: rateLimit.resetAfter || Math.ceil(3600 - (now % 3600000) / 1000) }),
      show_alert: true
    });
  }

  // AI 检测 - 调整置信度
  if (data === 'ai_confidence') {
    const text = t(lang, 'ai_confidence_prompt', { value: (await getAISpamDetectionConfig()).confidenceThreshold || 0.7 });

    await KV.put(`ai_confidence_wait:${adminChatId}`, '1', { expirationTtl: 120 });
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: t(lang, 'btn_back_ai'), callback_data: 'back_to_ai_menu' }]] }
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_ai_confidence_ask')
    });
  }

  // 垃圾话题 - 切换状态
  if (data === 'toggle_spam_topic') {
    const config = await getSpamTopicConfig();
    await setSpamTopicConfig({
      ...config,
      enabled: !config.enabled
    });

    const menu = await generateSpamTopicSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: !config.enabled ? t(lang, 'toast_st_on') : t(lang, 'toast_st_off')
    });
  }

  // 垃圾话题 - 自动创建
  if (data === 'create_spam_topic') {
    const groupId = GROUP_ID;
    if (!groupId) {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_no_group'),
        show_alert: true
      });
    }

    // 检查是否已有垃圾话题
    const config = await getSpamTopicConfig();
    if (config.topicId) {
      // 提供强制重新创建的选项
      const text = `${t(lang, 'st_exists_title')}

${t(lang, 'st_exists_body', { id: config.topicId })}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: t(lang, 'btn_force_recreate'), callback_data: 'force_create_spam_topic' }],
          [{ text: t(lang, 'btn_cancel'), callback_data: 'back_to_spamtopic_menu' }]
        ]
      };

      await requestTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_st_exists')
      });
    }

    const topicId = await createSpamTopic(groupId);
    if (topicId) {
      await setSpamTopicConfig({
        ...config,
        topicId: topicId
      });

      const menu = await generateSpamTopicSubmenu(lang);
      await requestTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: menu.reply_markup
      });
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_st_created', { id: topicId })
      });
    } else {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_st_create_failed'),
        show_alert: true
      });
    }
  }

  // 垃圾话题 - 强制重新创建
  if (data === 'force_create_spam_topic') {
    const groupId = GROUP_ID;
    if (!groupId) {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_no_group'),
        show_alert: true
      });
    }

    const config = await getSpamTopicConfig();
    const topicId = await createSpamTopic(groupId);
    if (topicId) {
      // 更新配置
      await setSpamTopicConfig({
        ...config,
        topicId: topicId
      });

      const menu = await generateSpamTopicSubmenu(lang);
      await requestTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: menu.reply_markup
      });
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_st_recreated', { id: topicId })
      });
    } else {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_st_create_failed_detail'),
        show_alert: true
      });
    }
  }

  // 返回垃圾话题菜单
  if (data === 'back_to_spamtopic_menu') {
    const menu = await generateSpamTopicSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_back_spamtopic')
    });
  }

  // 垃圾话题 - 配置话题 ID
  if (data === 'config_spam_topic_id') {
    const config = await getSpamTopicConfig();

    // 提示用户输入话题 ID
    const text = t(lang, 'st_config_prompt', { id: config.topicId || t(lang, 'st_not_set') });

    const keyboard = {
      inline_keyboard: [
        [{ text: t(lang, 'btn_back_spamtopic'), callback_data: 'back_to_spamtopic_menu' }]
      ]
    };

    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    // 设置一个临时状态，等待用户输入
    await KV.put(`spam_topic_config_wait:${adminChatId}`, 'config');
    // 保存菜单信息
    await KV.put(`spam_topic_menu:${adminChatId}`, JSON.stringify({
      chatId: chatId,
      messageId: messageId
    }), { expirationTtl: 300 });

    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_st_config_ask')
    });
  }

  // 垃圾话题 - 查看垃圾消息
  if (data === 'view_spam_messages') {
    const config = await getSpamTopicConfig();

    if (!config.topicId) {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_st_no_topic'),
        show_alert: true
      });
    }

    if (!GROUP_ID) {
      return requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'toast_no_group'),
        show_alert: true
      });
    }

    // 发送跳转到垃圾话题的链接
    const topicLink = `https://t.me/c/${GROUP_ID.replace('-100', '')}/${config.topicId}`;
    const statusOnOff = config.enabled ? t(lang, 'status_on_icon') : t(lang, 'status_off_icon');
    const text = `${t(lang, 'st_view_title')}

${t(lang, 'st_view_topic_id', { id: config.topicId })}
${t(lang, 'st_view_link')}<a href="${topicLink}">${t(lang, 'st_view_open_link')}</a>

${t(lang, 'st_view_stats_title')}
• ${t(lang, 'st_view_enabled', { status: statusOnOff })}
• ${t(lang, 'st_view_notify', { icon: config.notifyAdmin ? '✅' : '❌' })}

${t(lang, 'st_view_desc')}

${t(lang, 'st_view_actions')}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: t(lang, 'btn_open_topic'), url: topicLink }],
        [{ text: t(lang, 'btn_back_spamtopic'), callback_data: 'back_to_spamtopic_menu' }]
      ]
    };

    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'toast_st_view_shown')
    });
  }

  // 联合封禁 - 切换状态
  if (data === 'toggle_union') {
    const currentVal = await getConfig(CONFIG_KEYS.UNION_BAN, '0');
    const isEnabled = currentVal === '1' || currentVal === 'true';
    const newVal = isEnabled ? '0' : '1';
    await setConfig(CONFIG_KEYS.UNION_BAN, newVal);

    const menu = await generateUnionBanSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: isEnabled ? t(lang, 'toast_union_off') : t(lang, 'toast_union_on')
    });
  }

  // 刷新子菜单
  if (data === 'refresh_welcome') {
    const menu = await generateWelcomeSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_refreshed') });
  }

  if (data === 'refresh_autoreply') {
    const menu = await generateAutoreplySubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_refreshed') });
  }

  if (data === 'refresh_stats') {
    const menu = await generateStatsSubmenu(lang);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_refreshed') });
  }

  // 广播控制按钮
  if (data.startsWith('bcontinue:')) {
    const offset = parseInt(data.split(':')[1]) || 0;
    const broadcastMsg = await KV.get(`broadcast_msg:${adminChatId}`);

    if (!broadcastMsg) {
      await requestTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: t(lang, 'broadcast_expired_text'),
        parse_mode: 'HTML'
      });
      return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_bc_expired') });
    }

    // 先回复按钮，避免超时
    await requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_bc_sending') });

    const result = await sendBroadcastBatch(broadcastMsg, offset, 500);
    const statusIcon = result.timedOut ? '⚠️' : '📣';
    const statusText = result.timedOut ? t(lang, 'broadcast_title_partial') : t(lang, 'broadcast_title_done');

    // 构建按钮
    const inlineKeyboard = [];
    if (result.hasMore) {
      inlineKeyboard.push([{ text: t(lang, 'btn_bc_continue'), callback_data: `bcontinue:${result.nextOffset}` }]);
    }
    inlineKeyboard.push([{ text: t(lang, 'btn_bc_cancel'), callback_data: 'bcancel' }]);

    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `${statusIcon} <b>${statusText}</b>\n\n${t(lang, 'broadcast_sent_line', { sent: result.sent, total: result.total })}\n${t(lang, 'broadcast_failed_line', { failed: result.failed })}${result.skipped > 0 ? `\n${t(lang, 'broadcast_skipped_line', { skipped: result.skipped })}` : ''}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    return;
  }

  if (data === 'bcancel') {
    await KV.delete(`broadcast_msg:${adminChatId}`);
    await requestTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: t(lang, 'broadcast_cancelled_text'),
      parse_mode: 'HTML'
    });
    return requestTelegram('answerCallbackQuery', { callback_query_id: callbackQuery.id, text: t(lang, 'toast_cancelled') });
  }
}

// HTML 转义
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return String(unsafe || '');
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 处理管理员消息
async function handleAdminMessage(message) {
  let text = (message.text || '').trim();
  const reply = message.reply_to_message;
  const contextChatId = message.chat?.id ? String(message.chat.id) : null;
  const senderId = message.from ? String(message.from.id) : null;
  const adminChatId = senderId || ADMIN_UID || contextChatId;
  const lang = await getUserLang(adminChatId);
  const replyChatId = reply ? (reply.chat?.id ? String(reply.chat.id) : (contextChatId || adminChatId)) : null;

  // 【话题模式支持】检测是否在话题中发送消息
  const isTopicMode = await isTopicForwardingEnabled();
  // 只要消息来自论坛群组，就在本群组/话题内执行命令与回复（不再依赖转发模式开关）
  const isGroupContext = !!(GROUP_ID && contextChatId === String(GROUP_ID));
  const isInTopic = isGroupContext && !!message.message_thread_id;
  const isInGeneralTopic = isInTopic && message.message_thread_id === 1; // General 话题 ID 为 1

  Logger.info('admin_message_context', {
    contextChatId,
    GROUP_ID,
    message_thread_id: message.message_thread_id,
    isTopicMode,
    isInTopic,
    isInGeneralTopic,
    text: text.substring(0, 50)
  });

  // 辅助函数：获取回复目标（话题模式或私聊模式）
  const getReplyTarget = () => {
    if (isGroupContext) {
      const target = { chat_id: contextChatId };
      if (message.message_thread_id) target.message_thread_id = message.message_thread_id;
      return target;
    }
    return {
      chat_id: adminChatId
    };
  };

  // 【关键词管理】检查是否允许添加关键词（只在 General 话题或私聊中）
  const canManageKeywords = !isInTopic || isInGeneralTopic;

  // 【AI 置信度配置】检查是否在等待输入置信度阈值
  const aiConfidenceWaitKey = `ai_confidence_wait:${adminChatId}`;
  const isWaitingForAIConfidence = await KV.get(aiConfidenceWaitKey);
  if (isWaitingForAIConfidence) {
    const replyTarget = getReplyTarget();
    await KV.delete(aiConfidenceWaitKey);

    if (text.toLowerCase() === '/cancel' || text.toLowerCase() === 'cancel' || text.toLowerCase() === '取消') {
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'ai_confidence_cancelled')
      });
    }

    const newThreshold = parseFloat(text);
    if (isNaN(newThreshold) || newThreshold < 0.5 || newThreshold > 0.95) {
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'ai_confidence_invalid')
      });
    }

    const aiConfig = await getAISpamDetectionConfig();
    await setAISpamDetectionConfig({
      enabled: aiConfig.enabled,
      confidenceThreshold: newThreshold
    });

    return sendMessage({
      ...replyTarget,
      text: t(lang, 'ai_confidence_updated', { value: newThreshold }),
      parse_mode: 'HTML'
    });
  }

  // 【垃圾话题配置】检查是否在配置垃圾话题 ID 的等待状态
  const spamTopicWaitKey = `spam_topic_config_wait:${adminChatId}`;
  const isWaitingForSpamTopicId = await KV.get(spamTopicWaitKey);
  if (isWaitingForSpamTopicId) {
    const replyTarget = getReplyTarget();
    await KV.delete(spamTopicWaitKey);

    // 获取最后一个菜单消息 ID（从 KV 中存储）
    const lastMenuKey = `spam_topic_menu:${adminChatId}`;
    const lastMenuInfo = await KV.get(lastMenuKey);
    let lastMenuId = null;
    let lastChatId = adminChatId;
    if (lastMenuInfo) {
      try {
        const info = JSON.parse(lastMenuInfo);
        lastMenuId = info.messageId;
        lastChatId = info.chatId;
      } catch (e) {
        // 忽略解析错误
      }
    }

    if (text.toLowerCase() === '取消' || text.toLowerCase() === 'cancel') {
      if (lastMenuId) {
        const menu = await generateSpamTopicSubmenu(lang);
        await requestTelegram('editMessageText', {
          chat_id: lastChatId,
          message_id: lastMenuId,
          text: menu.text,
          parse_mode: 'HTML',
          reply_markup: menu.reply_markup
        });
      }
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'st_config_cancelled')
      });
    }

    if (text.toLowerCase() === '自动创建' || text.toLowerCase() === 'auto create') {
      const topicId = await createSpamTopic(GROUP_ID);
      if (topicId) {
        const config = await getSpamTopicConfig();
        await setSpamTopicConfig({
          ...config,
          topicId: topicId
        });

        if (lastMenuId) {
          const menu = await generateSpamTopicSubmenu(lang);
          await requestTelegram('editMessageText', {
            chat_id: lastChatId,
            message_id: lastMenuId,
            text: menu.text,
            parse_mode: 'HTML',
            reply_markup: menu.reply_markup
          });
        }

        return sendMessage({
          ...replyTarget,
          text: t(lang, 'st_auto_created', { id: topicId }),
          parse_mode: 'HTML'
        });
      } else {
        return sendMessage({
          ...replyTarget,
          text: t(lang, 'st_auto_create_failed')
        });
      }
    }

    // 尝试解析话题 ID（支持纯数字或带链接格式）
    let topicId = text.trim();
    const urlMatch = text.match(/\/c\/(\d+)\/(\d+)/);
    if (urlMatch) {
      topicId = urlMatch[2];
    }

    if (!/^\d+$/.test(topicId)) {
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'st_invalid_id')
      });
    }

    const config = await getSpamTopicConfig();
    await setSpamTopicConfig({
      ...config,
      topicId: topicId
    });

    // 刷新菜单
    if (lastMenuId) {
      const menu = await generateSpamTopicSubmenu(lang);
      await requestTelegram('editMessageText', {
        chat_id: lastChatId,
        message_id: lastMenuId,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: menu.reply_markup
      });
    }

    return sendMessage({
      ...replyTarget,
      text: t(lang, 'st_id_set', { id: topicId }),
      parse_mode: 'HTML'
    });
  }

  // 【修复】检查是否以 / 开头但不是有效命令
  // 如果是无效命令且是回复消息，防止转发给用户
  const validCommands = ['/help', '/menu', '/language', '/lang', '/welcome', '/autoreply', '/ban', '/unban', '/reset', '/trust', '/untrust', '/broadcast', '/bcancel', '/restore', '/start', '/cleanup', '/cachestats', '/clearcache', '/cancel'];
  const isValidCommand = validCommands.some(cmd => text === cmd || text.startsWith(cmd + ' '));
  const isCommandLike = text.startsWith('/') && text.length > 1;

  // 【话题模式】如果在话题中发送命令，只在话题内回复，不转发
  if (isInTopic && isCommandLike) {
    Logger.info('admin_command_in_topic', { text, threadId: message.message_thread_id });
  }

  // --- 管理指令区域 ---

  // 指令：/start - 推送命令菜单 + 显示帮助
  if (text === '/start') {
    await setBotCommands();
    // 直接 fall through 到 /help，显示完整的帮助信息
    text = '/help'; // 让后续匹配命中 /help
  }

  // 【话题模式】话题转发开启时，私聊里的 /menu、/help 改为引导去群组 General 话题，
  // 保证所有管理员用的是群组里的同一个面板（/start 会落到 /help，同样适用）
  if ((text === '/menu' || text === '/help') && message.chat?.type === 'private' && isTopicMode && GROUP_ID) {
    const redirectPayload = {
      chat_id: adminChatId,
      text: t(lang, 'panel_topic_redirect'),
      parse_mode: 'HTML'
    };
    if (/^-100\d+$/.test(String(GROUP_ID))) {
      redirectPayload.reply_markup = {
        inline_keyboard: [[
          { text: t(lang, 'btn_open_group'), url: `https://t.me/c/${String(GROUP_ID).slice(4)}/1` }
        ]]
      };
    }
    return sendMessage(redirectPayload);
  }

  // 指令：/help - 显示帮助信息
  if (text === '/help') {
    const verifyMode = await getVerifyMode();
    const spamFilterEnabled = await getSpamFilterEnabled();
    const replyTarget = getReplyTarget();
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'help_title') + '\n\n' + t(lang, 'help_body') + '\n\n' + t(lang, 'help_footer', { verifyMode: getVerifyModeName(verifyMode, lang), filterStatus: spamFilterEnabled ? t(lang, 'on') : t(lang, 'off') }),
      parse_mode: 'HTML'
    });
  }



  // 指令：/menu - 显示管理菜单
  if (text === '/menu') {
    const menu = await generateMainMenu(lang);
    const replyTarget = getReplyTarget();
    return sendMessage({
      ...replyTarget,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
  }

  // 指令：/language - 切换语言
  if (text === '/language' || text === '/lang' || text.startsWith('/language ') || text.startsWith('/lang ')) {
    const replyTarget = getReplyTarget();
    const menu = await generateLanguageSubmenu(lang);
    return sendMessage({
      ...replyTarget,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup
    });
  }

  // 指令：/welcome - 设置欢迎消息
  if (text.startsWith('/welcome')) {
    const content = text.slice(8).trim();
    const replyTarget = getReplyTarget();
    if (!content || content === 'delete') {
      await setConfig(CONFIG_KEYS.WELCOME_MSG, '');
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'welcome_deleted')
      });
    }
    await setConfig(CONFIG_KEYS.WELCOME_MSG, content);
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'welcome_set')
    });
  }

  // 指令：/autoreply - 设置自动回复
  if (text.startsWith('/autoreply')) {
    const content = text.slice(10).trim();
    const replyTarget = getReplyTarget();
    if (!content || content === 'off') {
      await setConfig(CONFIG_KEYS.AUTO_REPLY_MSG, '');
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'autoreply_off_done')
      });
    }
    await setConfig(CONFIG_KEYS.AUTO_REPLY_MSG, content);
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'autoreply_set')
    });
  }

  // 关键词管理 - 添加放行词
  if (text.startsWith('allow:')) {
    const keyword = text.slice(6).trim();
    const replyTarget = getReplyTarget();
    if (keyword) {
      const rules = await getSpamFilterRules();
      if (!rules.allowKeywords) rules.allowKeywords = [];
      if (!rules.allowKeywords.includes(keyword)) {
        rules.allowKeywords.push(keyword);
        await setSpamFilterRules(rules);
        return sendMessage({ ...replyTarget, text: t(lang, 'kw_allow_added', { keyword: escapeHtml(keyword) }), parse_mode: 'HTML' });
      }
      return sendMessage({ ...replyTarget, text: t(lang, 'kw_already_exists') });
    }
  }

  // 关键词管理 - 添加正则
  if (text.startsWith('regex:')) {
    const regex = text.slice(6).trim();
    const replyTarget = getReplyTarget();
    if (regex) {
      const rules = await getSpamFilterRules();
      if (!rules.regexes) rules.regexes = [];
      try {
        new RegExp(regex, 'i'); // 验证正则有效性
        rules.regexes.push(regex);
        await setSpamFilterRules(rules);
        return sendMessage({ ...replyTarget, text: t(lang, 'kw_regex_added', { regex: escapeHtml(regex) }), parse_mode: 'HTML' });
      } catch (e) {
        return sendMessage({ ...replyTarget, text: t(lang, 'kw_regex_invalid') });
      }
    }
  }

  // 关键词管理 - 删除拦截词
  if (text.startsWith('del:')) {
    const keyword = text.slice(4).trim();
    const replyTarget = getReplyTarget();
    if (keyword) {
      const rules = await getSpamFilterRules();
      const index = (rules.keywords || []).indexOf(keyword);
      if (index > -1) {
        rules.keywords.splice(index, 1);
        await setSpamFilterRules(rules);
        return sendMessage({ ...replyTarget, text: t(lang, 'kw_block_deleted', { keyword: escapeHtml(keyword) }), parse_mode: 'HTML' });
      }
      return sendMessage({ ...replyTarget, text: t(lang, 'kw_block_not_found') });
    }
  }

  // 关键词管理 - 删除放行词
  if (text.startsWith('delallow:')) {
    const keyword = text.slice(9).trim();
    const replyTarget = getReplyTarget();
    if (keyword) {
      const rules = await getSpamFilterRules();
      const index = (rules.allowKeywords || []).indexOf(keyword);
      if (index > -1) {
        rules.allowKeywords.splice(index, 1);
        await setSpamFilterRules(rules);
        return sendMessage({ ...replyTarget, text: t(lang, 'kw_allow_deleted', { keyword: escapeHtml(keyword) }), parse_mode: 'HTML' });
      }
      return sendMessage({ ...replyTarget, text: t(lang, 'kw_allow_not_found') });
    }
  }

  // 关键词管理 - 清空默认规则
  if (text === '清空默认' || text.toLowerCase() === 'clear defaults') {
    const replyTarget = getReplyTarget();
    await resetSpamFilterRules();
    return sendMessage({ ...replyTarget, text: t(lang, 'kw_rules_reset_done') });
  }

  // 链接数量设置
  if (text.startsWith('max_links:')) {
    const num = parseInt(text.slice(10));
    const replyTarget = getReplyTarget();
    if (!isNaN(num) && num >= 0) {
      const rules = await getSpamFilterRules();
      rules.maxLinks = num;
      await setSpamFilterRules(rules);
      return sendMessage({ ...replyTarget, text: t(lang, 'max_links_set', { count: num }) });
    }
    return sendMessage({ ...replyTarget, text: t(lang, 'invalid_number') });
  }

  // 普通文本 - 添加为拦截关键词（如果不是命令）
  // 【限制】只在 General 话题或私聊中允许添加关键词
  if (!reply && text && !text.startsWith('/') && text.length > 0) {
    const replyTarget = getReplyTarget();

    if (!canManageKeywords) {
      // 在用户话题中发送文本，不添加关键词，提示用户
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'kw_manage_general_only')
      });
    }

    // 检查是否在关键词管理上下文中
    const rules = await getSpamFilterRules();
    if (!rules.keywords) rules.keywords = [];

    // 避免重复添加
    if (!rules.keywords.includes(text)) {
      rules.keywords.push(text);
      await setSpamFilterRules(rules);
      return sendMessage({ ...replyTarget, text: t(lang, 'kw_added', { keyword: escapeHtml(text) }), parse_mode: 'HTML' });
    }
  }

  // 指令：/ban [ID] (支持回复或手输)
  if (text === '/ban' || text.startsWith('/ban ')) {
    const targetId = await getTargetId(message, '/ban');
    const replyTarget = getReplyTarget();
    if (targetId) {
      await KV.put('blocked-' + targetId, 'true');
      await invalidateBlockedCache(targetId);
      await removeVerifiedUser(targetId); // 从已验证列表移除
      return sendMessage({ ...replyTarget, text: t(lang, 'ban_success', { id: targetId }), parse_mode: 'HTML' });
    } else {
      return sendMessage({ ...replyTarget, text: t(lang, 'ban_usage') });
    }
  }

  // 指令：/unban [ID] (支持回复或手输)
  if (text === '/unban' || text.startsWith('/unban ')) {
    const targetId = await getTargetId(message, '/unban');
    const replyTarget = getReplyTarget();
    if (targetId) {
      await KV.delete('blocked-' + targetId);
      await invalidateBlockedCache(targetId);
      return sendMessage({ ...replyTarget, text: t(lang, 'unban_success', { id: targetId }), parse_mode: 'HTML' });
    } else {
      return sendMessage({ ...replyTarget, text: t(lang, 'unban_usage') });
    }
  }

  // 指令：/reset [ID] (支持回复或手输)
  if (text === '/reset' || text.startsWith('/reset ')) {
    const targetId = await getTargetId(message, '/reset');
    const replyTarget = getReplyTarget();
    if (targetId) {
      // 检查用户是否在白名单中
      const isWhite = await isWhitelisted(targetId);
      if (isWhite) {
        return sendMessage({
          ...replyTarget,
          text: t(lang, 'reset_whitelist_warning', { id: targetId }),
          parse_mode: 'HTML'
        });
      }

      await KV.delete('verified-' + targetId);
      await invalidateCache('verified-' + targetId);
      await removeVerifiedUser(targetId); // 从已验证列表移除
      return sendMessage({ ...replyTarget, text: t(lang, 'reset_success', { id: targetId }), parse_mode: 'HTML' });
    } else {
      return sendMessage({ ...replyTarget, text: t(lang, 'reset_usage') });
    }
  }

  // 指令：/broadcast - 广播消息
  if (text === '/broadcast' || text.startsWith('/broadcast ')) {
    const replyTarget = getReplyTarget();
    const broadcastMsg = text === '/broadcast' ? '' : text.slice(10).trim();
    if (!broadcastMsg) {
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'broadcast_usage'),
        parse_mode: 'HTML'
      });
    }

    // 检查 24 小时冷却（使用增强的限流）
    const rateLimit = checkRateLimit(adminChatId, 'broadcast');
    if (!rateLimit.allowed) {
      const remainingHours = Math.ceil(rateLimit.retryAfter / 3600);
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'broadcast_cooldown_limit', { hours: remainingHours, limit: rateLimit.limit })
      });
    }

    // 记录限流
    const lastBroadcast = await KV.get(`broadcast_cooldown:${adminChatId}`);
    if (lastBroadcast) {
      const lastTime = parseInt(lastBroadcast);
      const now = Date.now();
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 小时
      const remainingMs = cooldownMs - (now - lastTime);

      if (remainingMs > 0) {
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return sendMessage({
          ...replyTarget,
          text: t(lang, 'broadcast_cooldown', { hours: remainingHours })
        });
      }
    }

    // 保存消息到 KV（24小时过期）
    await KV.put(`broadcast_msg:${adminChatId}`, broadcastMsg, { expirationTtl: 86400 });
    // 记录广播时间
    await KV.put(`broadcast_cooldown:${adminChatId}`, Date.now().toString(), { expirationTtl: 86400 });

    // 发送第一批（500人）
    const result = await sendBroadcastBatch(broadcastMsg, 0, 500);
    const statusIcon = result.timedOut ? '⚠️' : '📣';
    const statusText = result.timedOut ? t(lang, 'broadcast_title_partial') : t(lang, 'broadcast_title_done');

    // 构建按钮
    const inlineKeyboard = [];
    if (result.hasMore) {
      inlineKeyboard.push([{ text: t(lang, 'btn_bc_continue'), callback_data: `bcontinue:${result.nextOffset}` }]);
    }
    inlineKeyboard.push([{ text: t(lang, 'btn_bc_cancel'), callback_data: 'bcancel' }]);

    return sendMessage({
      ...replyTarget,
      text: `${statusIcon} <b>${statusText}</b>\n\n${t(lang, 'broadcast_sent_line', { sent: result.sent, total: result.total })}\n${t(lang, 'broadcast_failed_line', { failed: result.failed })}${result.skipped > 0 ? `\n${t(lang, 'broadcast_skipped_line', { skipped: result.skipped })}` : ''}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  // 指令：/trust [ID] - 添加白名单（信任用户）
  if (text === '/trust' || text.startsWith('/trust ')) {
    const targetId = await getTargetId(message, '/trust');
    const replyTarget = getReplyTarget();
    if (targetId) {
      await addToWhitelist(targetId);
      return sendMessage({ ...replyTarget, text: t(lang, 'trust_success', { id: targetId }), parse_mode: 'HTML' });
    } else {
      // 如果没有指定 ID，显示当前白名单状态
      return sendMessage({ ...replyTarget, text: t(lang, 'trust_hint') });
    }
  }

  // 指令：/untrust [ID] - 删除白名单（取消信任）
  if (text === '/untrust' || text.startsWith('/untrust ')) {
    const targetId = await getTargetId(message, '/untrust');
    const replyTarget = getReplyTarget();
    if (targetId) {
      await removeFromWhitelist(targetId);
      return sendMessage({ ...replyTarget, text: t(lang, 'untrust_success', { id: targetId }), parse_mode: 'HTML' });
    } else {
      return sendMessage({ ...replyTarget, text: t(lang, 'untrust_hint') });
    }
  }

  // 指令：/bcancel - 取消广播（保留命令方式作为备选）
  if (text === '/bcancel') {
    const replyTarget = getReplyTarget();
    await KV.delete(`broadcast_msg:${adminChatId}`);
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'bcancel_done')
    });
  }

  // 指令：/cleanup - 批量清理失效的话题映射
  if (text === '/cleanup' || text.startsWith('/cleanup ')) {
    const args = text.split(/\s+/);
    const dryRun = args.includes('--dry-run') || args.includes('-n');
    const cleanAll = args.includes('--all') || args.includes('-a');

    return handleCleanupCommand(message, { dryRun, cleanAll }, adminChatId, getReplyTarget());
  }

  // 指令：/cachestats - 查看缓存统计
  if (text === '/cachestats') {
    const stats = getCacheStats();
    const replyTarget = getReplyTarget();
    const statsText = t(lang, 'cache_stats_text', { l1Hits: stats.l1.hits, l1Misses: stats.l1.misses, l1Rate: stats.l1.hitRate, l1Size: stats.l1.size, l2Hits: stats.l2.hits, l2Misses: stats.l2.misses, l2Rate: stats.l2.hitRate });

    return sendMessage({
      ...replyTarget,
      text: statsText,
      parse_mode: 'HTML'
    });
  }

  // 指令：/clearcache - 清空所有缓存
  if (text === '/clearcache') {
    const replyTarget = getReplyTarget();
    clearAllCache();
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'clearcache_done'),
      parse_mode: 'HTML'
    });
  }

  // 指令：/restore - 从垃圾话题恢复消息
  if (text === '/restore' && reply) {
    const replyTarget = getReplyTarget();
    const spamTopicConfig = await getSpamTopicConfig();
    const isTopicMode = await isTopicForwardingEnabled();

    if (!spamTopicConfig.topicId || !(await isSpamTopicEnabled())) {
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'restore_not_enabled')
      });
    }

    const replyChatIdStr = reply.chat?.id ? String(reply.chat.id) : null;
    if (replyChatIdStr !== GROUP_ID || !reply.message_thread_id || String(reply.message_thread_id) !== String(spamTopicConfig.topicId)) {
      return sendMessage({
        ...replyTarget,
        text: t(lang, 'restore_wrong_topic')
      });
    }

    const targetThreadId = isTopicMode ? await KV.get('spam-thread-' + reply.message_id) : null;
    const restoreResult = await restoreMessageFromSpamTopic(GROUP_ID, spamTopicConfig.topicId, targetThreadId, reply.message_id);

    if (restoreResult.success) {
      if (isTopicMode && targetThreadId) {
        await sendMessage({
          ...replyTarget,
          text: t(lang, 'restore_success_topic', { uid: restoreResult.guestChatId, topicId: targetThreadId }),
          parse_mode: 'HTML'
        });
      } else {
        await sendMessage({
          ...replyTarget,
          text: t(lang, 'restore_success_dm', { uid: restoreResult.guestChatId }),
          parse_mode: 'HTML'
        });
      }
    } else if (restoreResult.reason === 'no_mapping') {
      await sendMessage({
        ...replyTarget,
        text: t(lang, 'restore_no_mapping')
      });
    } else {
      await sendMessage({
        ...replyTarget,
        text: t(lang, 'restore_failed')
      });
    }
    return;
  }

  // --- 普通回复逻辑 ---

  // 【话题模式】在话题中发送命令时，不转发到私聊
  if (isInTopic && isCommandLike) {
    // 如果是有效命令，已经在上面处理了
    // 如果是无效命令，提示用户
    if (!isValidCommand) {
      return sendMessage({
        chat_id: contextChatId,
        text: t(lang, 'invalid_command_topic', { cmd: text.split(' ')[0] }),
        parse_mode: 'HTML',
        message_thread_id: message.message_thread_id
      });
    }
    // 有效命令已处理，这里不会执行到
    return;
  }

  // 检查是否在回复转发消息或编辑提示消息
  if (reply) {
    let guestChatId = null;

    // 【话题模式支持】从话题 ID 查找用户
    const isTopicMode = await isTopicForwardingEnabled();
    if (isTopicMode && reply.message_thread_id && contextChatId === GROUP_ID) {
      const threadId = reply.message_thread_id;
      guestChatId = await KV.get(`thread:${threadId}`);
      Logger.info('admin_reply_in_topic_mode', { adminChatId, threadId, guestChatId });
    }

    const scopedMessageMapKey = `msg-map-${contextChatId}:${reply.message_id}`;
    // 情况 1：回复转发消息
    if (!guestChatId && (reply.forward_from || reply.forward_sender_name)) {
      guestChatId = await KV.get(scopedMessageMapKey) || await KV.get('msg-map-' + reply.message_id);
    }
    // 情况 2：回复编辑提示消息（以 ✏️ 开头）
    if (!guestChatId && reply.text && reply.text.startsWith('✏️')) {
      guestChatId = await KV.get(scopedMessageMapKey) || await KV.get('msg-map-' + reply.message_id);
    }
    // 情况 3：回复垃圾过滤菜单消息
    if (!guestChatId && reply.text && (reply.text.includes('Spam Filter Settings') || reply.text.includes('垃圾消息过滤设置'))) {
      // 解析编辑内容
      const newRules = parseSpamRulesEdit(text);
      await setSpamFilterRules(newRules);

      // 刷新菜单
      const menu = await generateSpamFilterSubmenu(lang);
      await requestTelegram('editMessageText', {
        chat_id: replyChatId || contextChatId || adminChatId,
        message_id: reply.message_id,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: menu.reply_markup
      });

      return sendMessage({
        ...(isInTopic ? { chat_id: contextChatId, message_thread_id: message.message_thread_id } : { chat_id: adminChatId }),
        text: t(lang, 'spam_rules_updated')
      });
    }

    if (!guestChatId) {
      guestChatId = await KV.get(scopedMessageMapKey) || await KV.get('msg-map-' + reply.message_id);
    }

    // 【修复】检查是否是回复消息但发送了无效命令
    if (isCommandLike && !isValidCommand) {
      return sendMessage({
        ...(isInTopic ? { chat_id: contextChatId, message_thread_id: message.message_thread_id } : { chat_id: adminChatId }),
        text: t(lang, 'invalid_command', { cmd: text.split(' ')[0] }),
        parse_mode: 'HTML'
      });
    }

    if (guestChatId) {
      const copyPayload = {
        chat_id: guestChatId,
        from_chat_id: message.chat.id,
        message_id: message.message_id,
      };
      if (isInTopic) {
        const guestOrigMsgId = await KV.get('fwd-orig-' + reply.message_id);
        if (guestOrigMsgId) {
          copyPayload.reply_parameters = {
            message_id: parseInt(guestOrigMsgId, 10),
            allow_sending_without_reply: true,
            ...buildReplyQuoteParams(message)
          };
        }
      }
      const copyReq = await copyMessage(copyPayload);

      if (copyReq.ok && copyReq.result && copyReq.result.message_id) {
        const replyMapValue = JSON.stringify({
          guestChatId: guestChatId,
          guestMessageId: copyReq.result.message_id
        });
        await KV.put(`admin-reply-map-${message.chat.id}:${message.message_id}`, replyMapValue, { expirationTtl: 172800 });
        await KV.put('admin-reply-map-' + message.message_id, replyMapValue, { expirationTtl: 172800 });
        await KV.put(
          'guest-reply-map-' + guestChatId + ':' + copyReq.result.message_id,
          message.message_id.toString(),
          { expirationTtl: 172800 }
        );
        // 【表情回应】仅话题模式记录对等坐标（私聊模式不需要 react）。
        // 管理员原消息 ↔ 用户收到的副本，供表情镜像。
        if (isInTopic) {
          await storeReactionPeers(
            { chat_id: String(message.chat.id), message_id: message.message_id },
            { chat_id: String(guestChatId), message_id: copyReq.result.message_id }
          );
        }
      }

      return copyReq;
    } else {
      return sendMessage({
        ...(isInTopic ? { chat_id: contextChatId, message_thread_id: message.message_thread_id } : { chat_id: adminChatId }),
        text: t(lang, 'no_mapping_old')
      });
    }
  } else {
    // 既不是指令也不是回复，提示使用 /help
    const replyTarget = getReplyTarget();
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'help_hint'),
      parse_mode: 'HTML'
    });
  }
}

// 批量清理失效的话题映射
async function handleCleanupCommand(message, options = {}, overrideChatId = null, overrideTarget = null) {
  const { dryRun = false, cleanAll = false } = options;
  const adminChatId = overrideChatId || (message.chat?.id ? String(message.chat.id) : ADMIN_UID);
  // 进度与结果发回命令被调用的会话（私聊或群组话题），不再固定发管理员私聊
  const replyTarget = overrideTarget || { chat_id: adminChatId };
  const groupId = getEnv('GROUP_ID');
  const lang = await getUserLang(adminChatId);

  if (!groupId) {
    return sendMessage({
      ...replyTarget,
      text: t(lang, 'cleanup_no_group')
    });
  }

  // 发送开始通知
  const startMsg = dryRun ? t(lang, 'cleanup_scan_dry') : t(lang, 'cleanup_scan');
  const progressMsg = await sendMessage({
    ...replyTarget,
    text: `${startMsg}\n\n${t(lang, 'cleanup_scanning')}`,
    parse_mode: 'HTML'
  });

  try {
    // 获取所有用户数据
    const userKeys = [];
    let cursor = undefined;

    // 分批读取所有 user:* 键
    while (true) {
      const listOptions = {
        prefix: 'user:',
        limit: 1000
      };
      if (cursor) {
        listOptions.cursor = cursor;
      }

      const result = await KV.list(listOptions);
      for (const key of result.keys) {
        userKeys.push(key.name);
      }

      if (result.list_complete) {
        break;
      }
      cursor = result.cursor;
    }

    Logger.info('cleanup_scan_started', { totalKeys: userKeys.length });

    let invalidCount = 0;
    let cleanedCount = 0;
    let errorCount = 0;
    const invalidUsers = [];

    // 检查每个用户的话题
    for (let i = 0; i < userKeys.length; i++) {
      const key = userKeys[i];
      const userId = key.replace('user:', '');

      try {
        const userData = await safeGetJSON(key, null);
        if (!userData || !userData.thread_id) {
          continue; // 没有话题 ID，跳过
        }

        const threadId = userData.thread_id;

        // 检查话题是否有效
        const isValid = await validateForumThread(groupId, threadId);

        if (!isValid) {
          invalidCount++;
          invalidUsers.push({ userId, threadId });

          if (!dryRun) {
            // 删除失效的映射
            await safeKvDelete(key); // user:{userId}
            await safeKvDelete(`thread:${threadId}`); // thread:{threadId}
            await safeKvDelete(`verified-${userId}`);

            await invalidateCache(key);
            await invalidateCache(`verified-${userId}`);
            memDelete(`thread:${threadId}`);
            threadHealthCache.delete(`thread:${threadId}`);

            cleanedCount++;
          }
        }

        // 每 100 个用户更新一次进度
        if ((i + 1) % 100 === 0) {
          await requestTelegram('editMessageText', {
            chat_id: replyTarget.chat_id,
            message_id: progressMsg.result.message_id,
            text: `${startMsg}\n\n${t(lang, 'cleanup_progress', { done: i + 1, total: userKeys.length, invalid: invalidCount })}${!dryRun ? `\n${t(lang, 'cleanup_progress_cleaned', { cleaned: cleanedCount })}` : ''}`,
            parse_mode: 'HTML'
          });
        }

        // 避免触发速率限制
        if ((i + 1) % 50 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }

      } catch (e) {
        errorCount++;
        Logger.error('cleanup_check_user_failed', e, { userId, key });
      }
    }

    // 更新最终结果
    const resultText = [
      t(lang, 'cleanup_done_title'),
      ``,
      t(lang, 'cleanup_stats_title'),
      `• ${t(lang, 'cleanup_total_users', { count: userKeys.length })}`,
      `• ${t(lang, 'cleanup_invalid_topics', { count: invalidCount })}`,
      !dryRun ? `• ${t(lang, 'cleanup_cleaned', { count: cleanedCount })}` : `• ${t(lang, 'cleanup_preview_note')}`,
      errorCount > 0 ? `• ${t(lang, 'cleanup_errors', { count: errorCount })}` : null
    ].filter(Boolean).join('\n');

    if (invalidCount > 0 && !dryRun) {
      // 附加详细信息（最多显示 20 个）
      const detailLimit = Math.min(20, invalidUsers.length);
      const details = invalidUsers.slice(0, detailLimit)
        .map(u => `• User ${u.userId}: Topic ${u.threadId}`)
        .join('\n');

      const moreText = invalidUsers.length > detailLimit ? `\n${t(lang, 'cleanup_more', { count: invalidUsers.length - detailLimit })}` : '';

      await requestTelegram('editMessageText', {
        chat_id: replyTarget.chat_id,
        message_id: progressMsg.result.message_id,
        text: `${resultText}\n\n${t(lang, 'cleanup_invalid_list_title')}\n${details}${moreText}`,
        parse_mode: 'HTML'
      });
    } else {
      await requestTelegram('editMessageText', {
        chat_id: replyTarget.chat_id,
        message_id: progressMsg.result.message_id,
        text: resultText,
        parse_mode: 'HTML'
      });
    }

    Logger.info('cleanup_completed', {
      total: userKeys.length,
      invalid: invalidCount,
      cleaned: cleanedCount,
      errors: errorCount,
      dryRun
    });

  } catch (e) {
    Logger.error('cleanup_failed', e);
    await requestTelegram('editMessageText', {
      chat_id: replyTarget.chat_id,
      message_id: progressMsg.result.message_id,
      text: t(lang, 'cleanup_failed', { error: e.message }),
      parse_mode: 'HTML'
    });
  }
}

// 处理验证流程
async function handleVerification(message, chatId, origin) {
  // 获取当前验证模式
  const verifyMode = await getVerifyMode();
  const lang = await getUserLang(chatId);
  const text = (message?.text || '').trim();

  // 【并发保护】暂存当前消息（如果有）
  if (message && message.message_id && text !== '/start') {
    const queue = await appendPendingQueue(chatId, message);
    Logger.debug('message_queued_for_verification', { userId: chatId, messageId: message.message_id, queueLength: queue.length });

    // 如果队列已满，提示用户
    if (queue.length >= CONFIG.PENDING_MAX_MESSAGES) {
      await sendMessage({
        chat_id: chatId,
        text: t(lang, 'verify_pending_queued', { max: CONFIG.PENDING_MAX_MESSAGES })
      });
    }
  }

  // 本地题库验证
  if (verifyMode === 'local_quiz') {
    // 【并发保护】检查是否已有进行中的验证
    const existingChallenge = await getQuizChallenge(chatId);
    if (existingChallenge) {
      // 已有验证在进行中，不重复下发题目
      Logger.debug('verification_already_in_progress', { userId: chatId });
      return;
    }

    // 检查频率限制
    const limitCheck = await checkLocalQuizTriggerLimit(chatId);
    if (!limitCheck.allowed) {
      return sendMessage({
        chat_id: chatId,
        text: t(lang, 'verify_too_frequent')
      });
    }

    // 创建新题目
    const { question } = await createQuizChallenge(chatId);

    // 获取自定义欢迎消息
    const welcomeMsg = await getConfig(CONFIG_KEYS.WELCOME_MSG);
    const verificationText = welcomeMsg
      ? welcomeMsg + '\n\n' + t(lang, 'verify_quiz_with_welcome')
      : t(lang, 'verify_quiz_default');
    const questionText = (question.q && (question.q[lang] || question.q.en)) || '';

    return sendMessage({
      chat_id: chatId,
      text: `${verificationText}\n\n<b>${escapeHtml(questionText)}</b>`,
      parse_mode: 'HTML',
      reply_markup: generateQuizKeyboard(question, lang)
    });
  }

  // Turnstile 验证或双重验证
  let session;
  try {
    session = await createTurnstileSession(chatId);
  } catch (e) {
    Logger.error('turnstile_session_create_failed', e, { userId: chatId });
  }

  if (!session) {
    return sendMessage({
      chat_id: chatId,
      text: t(lang, 'verify_session_failed')
    });
  }

  const verifyUrl = `${origin}/verify?session=${encodeURIComponent(session.sessionId)}&sig=${encodeURIComponent(session.signature)}&lang=${encodeURIComponent(lang)}`;

  // 获取自定义欢迎消息
  const welcomeMsg = await getConfig(CONFIG_KEYS.WELCOME_MSG);
  let verificationText;

  if (verifyMode === 'both') {
    verificationText = welcomeMsg
      ? welcomeMsg + '\n\n' + t(lang, 'verify_both_with_welcome')
      : t(lang, 'verify_both_default');
  } else {
    verificationText = welcomeMsg
      ? welcomeMsg + '\n\n' + t(lang, 'verify_turnstile_with_welcome')
      : t(lang, 'verify_turnstile_default');
  }

  return sendMessage({
    chat_id: chatId,
    text: verificationText,
    reply_markup: {
      inline_keyboard: [[
        { text: t(lang, 'btn_verify_turnstile'), web_app: { url: verifyUrl } }
      ]]
    }
  });
}

// 渲染验证页面
function handleVerifyPage(request) {
  const siteKey = getTurnstileSiteKey();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  const sessionSignature = url.searchParams.get('sig');
  const pageLang = normalizeLang(url.searchParams.get('lang')) || 'en';
  const htmlLang = pageLang === 'zh' ? 'zh-CN' : 'en';

  if (!siteKey) {
    return new Response(t(pageLang, 'verify_not_configured'), {
      status: 503,
      headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
  }

  if (!sessionId || !sessionSignature) {
    return new Response('Invalid verification session', {
      status: 400,
      headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
  }

  // 页面文案（语言来自 ?lang= 参数，默认英文）
  const pageText = {
    title: t(pageLang, 'verify_page_title'),
    heading: t(pageLang, 'verify_page_heading'),
    subtitle: t(pageLang, 'verify_page_subtitle'),
    success: t(pageLang, 'verify_page_success'),
    successDesc: t(pageLang, 'verify_page_success_desc'),
    error: t(pageLang, 'verify_page_error'),
    errorDesc: t(pageLang, 'verify_page_error_desc'),
    retry: t(pageLang, 'verify_page_retry'),
    footer: t(pageLang, 'verify_page_footer'),
    loading: t(pageLang, 'verify_page_loading')
  };

  const html = `
  <!DOCTYPE html>
  <html lang="${htmlLang}">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${pageText.title}</title>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
              transition: background-color 0.3s ease, color 0.3s ease;
          }
          
          body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          
          /* 浅色模式 - Soft UI 风格 */
          .theme-light {
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          }
          
          .theme-light .card {
              background: white;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
          }
          
          .theme-light .icon-bg {
              background: #eef2ff;
          }
          
          .theme-light .icon-color {
              color: #6366f1;
          }
          
          .theme-light .text-primary {
              color: #1e293b;
          }
          
          .theme-light .text-secondary {
              color: #64748b;
          }
          
          .theme-light .error-bg {
              background: #fef2f2;
          }
          
          .theme-light .error-text {
              color: #dc2626;
          }
          
          .theme-light .success-bg {
              background: #f0fdf4;
          }
          
          .theme-light .success-icon {
              color: #16a34a;
          }
          
          /* 深色模式 - Soft UI 风格 */
          .theme-dark {
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          }
          
          .theme-dark .card {
              background: #1e293b;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          }
          
          .theme-dark .icon-bg {
              background: #312e81;
          }
          
          .theme-dark .icon-color {
              color: #818cf8;
          }
          
          .theme-dark .text-primary {
              color: #f1f5f9;
          }
          
          .theme-dark .text-secondary {
              color: #94a3b8;
          }
          
          .theme-dark .error-bg {
              background: rgba(220, 38, 38, 0.15);
          }
          
          .theme-dark .error-text {
              color: #f87171;
          }
          
          .theme-dark .success-bg {
              background: rgba(22, 163, 74, 0.15);
          }
          
          .theme-dark .success-icon {
              color: #4ade80;
          }
          
          /* 按钮样式 - Soft UI */
          .btn-primary {
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
              box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);
          }
          
          .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.4);
          }
          
          .btn-primary:active {
              transform: translateY(0);
          }
          
          .btn-secondary {
              background: #f1f5f9;
          }
          
          .theme-dark .btn-secondary {
              background: #334155;
          }
          
          .turnstile-container {
              min-height: 65px;
              display: flex;
              align-items: center;
              justify-content: center;
          }
          
          .hidden {
              display: none !important;
          }
      </style>
  </head>
  <body class="theme-light min-h-screen flex items-center justify-center p-4 md:p-6">
      <div class="w-full max-w-md">
          <!-- Main card - Soft UI -->
          <div class="card rounded-3xl p-6 md:p-8 text-center transition-all duration-300">
              <!-- Icon -->
              <div class="icon-bg w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-all duration-300">
                  <svg class="icon-color w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
              </div>
              
              <!-- Title -->
              <h1 class="text-primary text-xl md:text-2xl font-semibold mb-2 transition-colors duration-300">${pageText.heading}</h1>
              <p class="text-secondary text-sm md:text-base mb-8 transition-colors duration-300">${pageText.subtitle}</p>
              
              <!-- Turnstile widget -->
              <div id="verify-section" class="turnstile-container mb-6">
                  <div id="turnstile-widget" class="cf-turnstile" data-sitekey="${siteKey}" data-callback="onVerify" data-theme="auto"></div>
              </div>
              
              <!-- Loading state -->
              <div id="loading-msg" class="hidden mb-6">
                  <div class="inline-flex items-center gap-2 text-secondary">
                      <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span class="text-sm">${pageText.loading}</span>
                  </div>
              </div>
              
              <!-- Success message -->
              <div id="success-msg" class="hidden">
                  <div class="success-bg w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300">
                      <svg class="success-icon w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                  </div>
                  <h2 class="text-primary text-lg md:text-xl font-semibold mb-2 transition-colors duration-300">${pageText.success}</h2>
                  <p class="text-secondary text-sm md:text-base transition-colors duration-300">${pageText.successDesc}</p>
              </div>
              
              <!-- Error message -->
              <div id="error-msg" class="hidden mt-4">
                  <div class="error-bg rounded-2xl p-4 mb-4 transition-all duration-300">
                      <p class="error-text text-sm font-medium">${pageText.error}</p>
                      <p class="text-secondary text-xs mt-1">${pageText.errorDesc}</p>
                  </div>
                  <!-- Retry button -->
                  <button onclick="resetVerification()" class="btn-primary text-white font-medium px-6 py-3 rounded-2xl transition-all duration-200">
                      ${pageText.retry}
                  </button>
              </div>
          </div>
          
          <!-- Footer -->
          <div class="mt-6 text-center">
              <p class="text-secondary text-xs transition-colors duration-300">${pageText.footer}</p>
          </div>
      </div>

      <script>
          // 初始化 Telegram Web App
          let tg;
          let currentTheme = 'light';
          
          try {
              tg = window.Telegram.WebApp;
              if (tg) {
                  tg.ready();
                  tg.expand();
                  
                  // 获取 Telegram 主题
                  const themeParams = tg.themeParams;
                  currentTheme = tg.colorScheme || 'light';
                  
                  // 应用主题
                  applyTheme(currentTheme);
                  
                  // 监听主题变化
                  tg.onEvent('themeChanged', function() {
                      currentTheme = tg.colorScheme || 'light';
                      applyTheme(currentTheme);
                  });
              }
          } catch (e) {
              console.log('Telegram Web App init failed:', e);
              // 检测系统主题
              if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  applyTheme('dark');
              }
          }
          
          // 应用主题
          function applyTheme(theme) {
              document.body.classList.remove('theme-light', 'theme-dark');
              document.body.classList.add('theme-' + theme);
              
              // 更新 Turnstile 主题
              const turnstileWidget = document.getElementById('turnstile-widget');
              if (turnstileWidget) {
                  turnstileWidget.setAttribute('data-theme', theme);
              }
              
              // 更新 Telegram Web App 主题色
              if (tg) {
                  const bgColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                  tg.setHeaderColor(bgColor);
                  tg.setBackgroundColor(bgColor);
              }
          }
          
          // 重置验证
          function resetVerification() {
              // 隐藏错误消息
              document.getElementById('error-msg').classList.add('hidden');
              
              // 显示验证区域
              document.getElementById('verify-section').classList.remove('hidden');
              
              // 重置 Turnstile
              if (typeof turnstile !== 'undefined') {
                  turnstile.reset();
              } else {
                  // 如果 Turnstile API 不可用，刷新页面
                  window.location.reload();
              }
          }

          function onVerify(token) {
              const urlParams = new URLSearchParams(window.location.search);
              const session = urlParams.get('session');
              const signature = urlParams.get('sig');
              
              if (!session || !signature) {
                  showError();
                  return;
              }
              
              // 显示加载状态
              document.getElementById('verify-section').classList.add('hidden');
              document.getElementById('loading-msg').classList.remove('hidden');

              // 获取用户信息
              let userInfo = null;
              try {
                  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                      const user = tg.initDataUnsafe.user;
                      userInfo = {
                          id: user.id,
                          first_name: user.first_name || '',
                          last_name: user.last_name || '',
                          username: user.username || ''
                      };
                  }
              } catch (e) {
                  console.log('Failed to read user info:', e);
              }

              fetch('/verify-callback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, session, signature, userInfo })
              })
              .then(response => {
                  if (response.ok) {
                      // 隐藏加载状态，显示成功消息
                      document.getElementById('loading-msg').classList.add('hidden');
                      document.getElementById('success-msg').classList.remove('hidden');
                      
                      // 验证成功 1.5 秒后尝试关闭窗口
                      setTimeout(() => {
                          try {
                              if (tg) {
                                  tg.close();
                              }
                          } catch (e) {
                              console.log('Failed to close window:', e);
                          }
                      }, 1500);
                  } else {
                      throw new Error('Verification failed');
                  }
              })
              .catch(err => {
                  console.error('Verification failed:', err);
                  showError();
              });
          }
          
          function showError() {
              document.getElementById('loading-msg').classList.add('hidden');
              document.getElementById('verify-section').classList.add('hidden');
              document.getElementById('error-msg').classList.remove('hidden');
          }
      </script>
  </body>
  </html>
    `;
  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' }
  });
}

// 处理验证回调
async function handleVerifyCallback(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { token, session, signature, userInfo } = await request.json();

    if (!token || !session || !signature) {
      return new Response('Missing token or session', { status: 400 });
    }

    const sessionInfo = await validateTurnstileSession(session, signature);
    if (!sessionInfo.valid) {
      return new Response('Invalid verification session', { status: 400 });
    }

    const uid = sessionInfo.userId;
    const secretKey = getTurnstileSecretKey();
    if (!secretKey) {
      return new Response('Turnstile not configured', { status: 503 });
    }

    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    }).then(r => r.json());

    if (!result.success) {
      Logger.warn('turnstile_verification_failed', { userId: uid, errors: result['error-codes'] });
      return new Response('Verification failed', { status: 400 });
    }

    const allowedHostnames = getTurnstileAllowedHostnames();
    if (allowedHostnames.length && (!result.hostname || !allowedHostnames.includes(result.hostname))) {
      Logger.warn('turnstile_hostname_mismatch', { userId: uid, hostname: result.hostname });
      return new Response('Hostname mismatch', { status: 400 });
    }

    const expectedAction = getTurnstileExpectedAction();
    if (expectedAction && result.action && result.action !== expectedAction) {
      Logger.warn('turnstile_action_mismatch', { userId: uid, action: result.action, expected: expectedAction });
      return new Response('Action mismatch', { status: 400 });
    }

    await consumeTurnstileSession(session);

    const verifiedKey = 'verified-' + String(uid);
    await KV.put(verifiedKey, 'true', { expirationTtl: VERIFICATION_TTL });
    memSet(verifiedKey, 'true', 5 * 60 * 1000);
    await cacheApiSet(verifiedKey, 'true', 300);

    let displayName = 'Unknown';
    if (userInfo) {
      if (userInfo.first_name || userInfo.last_name) {
        displayName = `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim();
      } else if (userInfo.username) {
        displayName = `@${userInfo.username}`;
      }
    }

    await addVerifiedUser(uid, displayName);

    if (userInfo) {
      await upsertUserProfileFromUpdate(userInfo);
    }

    const turnstileVerifyMode = await getVerifyMode();
    const turnstileMethod = turnstileVerifyMode === 'both' ? 'both' : 'turnstile';
    markPendingVerifyMethod(uid, turnstileMethod);

    const pendingResult = await processPendingMessagesAfterVerification(uid);
    Logger.info('turnstile_verification_success', { userId: uid, pendingForwarded: pendingResult.forwarded });

    const guestLang = await getUserLang(uid);
    let successMsg = t(guestLang, 'turnstile_success');
    if (pendingResult.forwarded > 0) {
      successMsg = t(guestLang, 'turnstile_success_pending', { count: pendingResult.forwarded });
    }
    await sendMessage({
      chat_id: uid,
      text: successMsg
    });

    // 新用户接入通知（统一走 notifyNewUserVerified：按转发模式路由 + 去重）
    await notifyNewUserVerified(uid, userInfo || await getUserProfile(uid), turnstileMethod);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}

// 获取验证有效期配置
async function getVerificationTtl() {
  const ttl = await getConfig(CONFIG_KEYS.VERIFY_TTL, VERIFICATION_TTL);
  return parseInt(ttl) || VERIFICATION_TTL;
}

// 处理访客消息 (已验证)
async function handleGuestMessage(message) {
  // 【修复】过滤 /start 命令，不转发给管理员
  const text = (message.text || '').trim();
  if (text === '/start') {
    return; // 静默忽略 /start 命令
  }

  const userId = message.chat.id.toString();
  Logger.info('handle_guest_message_start', { userId, text: text ? text.substring(0, 50) : '[media]' });

  // 记录统计信息
  await incrementMessageCount();
  await recordActiveUser(userId);

  const desiredTopicMode = await isTopicForwardingEnabled();
  Logger.info('handle_guest_message_mode_check', { userId, desiredTopicMode, GROUP_ID, ADMIN_UID });

  let topicContext = null;
  if (desiredTopicMode) {
    Logger.info('handle_guest_message_calling_ensure_topic', { userId });
    topicContext = await ensureUserTopic(userId, message.from || await getUserProfile(userId));
    Logger.info('handle_guest_message_topic_context', { userId, topicContext });
    if (!topicContext) {
      Logger.warn('topic_forwarding_unavailable', { userId });
    }
  }

  Logger.info('handle_guest_message_before_media_group', { userId, hasTopicContext: !!topicContext });
  return handleMediaGroup(message, async (messages) => {
    Logger.info('handle_guest_message_in_media_group', { userId, messageCount: messages.length });
    if (topicContext && topicContext.threadId) {
      const topicResult = await forwardMessagesToTopic(messages, userId, topicContext.threadId);
      Logger.info('handle_guest_message_topic_forward_result', { userId, ok: topicResult?.ok });
      if (topicResult?.ok) {
        return topicResult;
      }
    }
    Logger.info('handle_guest_message_forwarding_to_admin', { userId });
    return forwardMessagesToAdmin(messages, userId);
  });
}

async function forwardMessagesToAdmin(messages, userId) {
  if (!ADMIN_ID_LIST.length) {
    Logger.error('admin_uid_missing_forward', { userId });
    return { ok: false, errorType: 'admin_missing' };
  }

  const results = await Promise.all(ADMIN_ID_LIST.map(adminId =>
    forwardMessagesToTarget(messages, userId, { chatId: adminId, label: 'admin_dm' })
  ));
  const successful = results.filter(result => result?.ok);
  if (successful.length > 0) {
    return { ok: true, result: successful[0].result };
  }
  if (results.length && results.every(result => result?.errorType === 'bot_blocked')) {
    const guestLang = await getUserLang(userId);
    await sendMessage({
      chat_id: userId,
      text: t(guestLang, 'forward_all_admins_blocked')
    });
  }
  return results[0] || { ok: false, errorType: 'forward_failed' };
}

async function forwardMessagesToTopic(messages, userId, threadId, attempt = 1) {
  if (!GROUP_ID) return { ok: false, errorType: 'group_missing' };
  const target = { chatId: GROUP_ID, threadId, label: 'topic' };
  const result = await forwardMessagesToTarget(messages, userId, target);
  if (result.ok) {
    return result;
  }

  if (result.errorType === 'thread_not_found' && attempt < 2) {
    await invalidateUserTopicMapping(userId, threadId);
    const profile = await getUserProfile(userId);
    const newTopic = await ensureUserTopic(userId, profile);
    if (newTopic?.threadId && newTopic.threadId !== threadId) {
      return forwardMessagesToTopic(messages, userId, newTopic.threadId, attempt + 1);
    }
  }

  return result;
}

async function forwardMessagesToTarget(messages, userId, target) {
  if (!messages || messages.length === 0) {
    return { ok: false, errorType: 'empty' };
  }
  if (messages.length === 1) {
    const msg = messages[0];

    // 【话题模式】一律用 copyMessage 复制到话题，不显示「转发自 XX」头部（靠话题名标识用户）。
    // 若用户引用了某条 bot 消息，再带上 reply_parameters，让管理员看到被引用的原消息。
    // （forwardMessage 不支持 reply_parameters；话题已标识用户，复制无来源歧义）
    if (target.label === 'topic') {
      const copyPayload = {
        chat_id: target.chatId,
        from_chat_id: msg.chat.id,
        message_id: msg.message_id
      };
      if (target.threadId) copyPayload.message_thread_id = target.threadId;

      if (msg.reply_to_message && msg.reply_to_message.message_id) {
        const adminOrigMsgId = await KV.get('guest-reply-map-' + userId + ':' + msg.reply_to_message.message_id);
        if (adminOrigMsgId) {
          copyPayload.reply_parameters = {
            message_id: parseInt(adminOrigMsgId, 10),
            allow_sending_without_reply: true,
            ...buildReplyQuoteParams(msg)
          };
        }
      }

      const copyReq = await requestTelegram('copyMessage', copyPayload);
      if (copyReq.ok && copyReq.result && copyReq.result.message_id) {
        // 注意：copyMessage 返回的是 MessageId 对象，不含 message_thread_id，
        // 无法做线程校验。payload 已指定 message_thread_id，Telegram 保证投递到正确话题。
        await storeForwardMapping(copyReq.result.message_id, msg, target);
        return { ok: true, result: copyReq.result };
      }
      // copyMessage 失败：交给统一错误处理（话题失效会触发重建）
      const outcome = await handleSingleForwardResult(copyReq, msg, target, userId);
      if (outcome.success) {
        return { ok: true, result: copyReq.result };
      }
      return { ok: false, errorType: outcome.errorType, raw: copyReq };
    }

    const payload = {
      chat_id: target.chatId,
      from_chat_id: msg.chat.id,
      message_id: msg.message_id
    };
    if (target.threadId) payload.message_thread_id = target.threadId;

    const forwardReq = await forwardMessage(payload);
    const outcome = await handleSingleForwardResult(forwardReq, msg, target, userId);
    if (outcome.success) {
      return { ok: true, result: forwardReq.result };
    }
    return { ok: false, errorType: outcome.errorType, raw: forwardReq };
  }

  const firstMsg = messages[0];
  const messageIds = messages.map(m => m.message_id);

  // 【话题模式】批量也用 copyMessages 复制到话题，不显示「转发自 XX」头部
  if (target.label === 'topic') {
    const copyPayload = {
      chat_id: target.chatId,
      from_chat_id: firstMsg.chat.id,
      message_ids: messageIds
    };
    if (target.threadId) copyPayload.message_thread_id = target.threadId;

    const copyReq = await requestTelegram('copyMessages', copyPayload);
    const outcome = await handleBatchForwardResult(copyReq, messages, target, userId, messageIds.length);
    if (outcome.success) {
      return { ok: true, result: copyReq.result };
    }
    return { ok: false, errorType: outcome.errorType, raw: copyReq };
  }

  const payload = {
    chat_id: target.chatId,
    from_chat_id: firstMsg.chat.id,
    message_ids: messageIds
  };
  if (target.threadId) payload.message_thread_id = target.threadId;

  const forwardReq = await forwardMessagesWithFallback(payload);
  const outcome = await handleBatchForwardResult(forwardReq, messages, target, userId, messageIds.length);
  if (outcome.success) {
    return { ok: true, result: forwardReq.result };
  }
  return { ok: false, errorType: outcome.errorType, raw: forwardReq };
}

async function handleSingleForwardResult(result, msg, target, userId) {
  if (result.ok && result.result && result.result.message_id) {
    if (!isForwardedToExpectedThread(result, target)) {
      Logger.warn('single_forward_misdirected_thread', { userId, expectedThreadId: target.threadId, actualThreadId: result.result.message_thread_id });
      await deleteForwardedResultMessages(result, target);
      return { success: false, errorType: 'thread_not_found' };
    }
    await storeForwardMapping(result.result.message_id, msg, target);
    return { success: true };
  }

  if (!result.ok && shouldAttemptCopyFallback(target)) {
    const copyOutcome = await tryCopySingleMessage(msg, target);
    if (copyOutcome.success) {
      return { success: true };
    }
    result = copyOutcome.rawResult || result;
  }

  const errorType = result.errorType || 'unknown';
  if (errorType === 'message_not_found') {
    Logger.warn('message_not_found', { userId, messageId: msg.message_id, target: target.label });
    return { success: true };
  }
  if (errorType === 'thread_not_found' && target.label === 'topic') {
    Logger.warn('topic_thread_not_found', { userId, threadId: target.threadId });
    return { success: false, errorType };
  }
  if (errorType === 'bot_blocked' && target.label === 'admin_dm') {
    Logger.warn('bot_blocked_by_admin', { userId, adminId: target.chatId });
    return { success: false, errorType };
  }

  await notifyForwardFailure(target, result);
  return { success: false, errorType };
}

async function handleBatchForwardResult(result, messages, target, userId, count) {
  if (result.ok && Array.isArray(result.result)) {
    for (let i = 0; i < messages.length; i++) {
      const forwardedMsg = result.result[i];
      const origMsg = messages[i];
      if (forwardedMsg && forwardedMsg.message_id) {
        await storeForwardMapping(forwardedMsg.message_id, origMsg, target);
      }
    }
    return { success: true };
  }

  if (!result.ok && shouldAttemptCopyFallback(target)) {
    const fallbackResult = await copyMessagesIndividually(messages, target);
    if (fallbackResult.success) {
      return { success: true };
    }
    result = fallbackResult.rawResult || result;
  }

  const errorType = result.errorType || 'unknown';
  if (errorType === 'message_not_found') {
    Logger.warn('batch_messages_not_found', { userId, target: target.label, count });
    return { success: true };
  }
  if (errorType === 'thread_not_found' && target.label === 'topic') {
    Logger.warn('batch_topic_thread_not_found', { userId, target: target.label, threadId: target.threadId });
    return { success: false, errorType };
  }

  await notifyForwardFailure(target, result);
  return { success: false, errorType };
}

async function storeForwardMapping(forwardedMessageId, originalMessage, target = null) {
  if (!forwardedMessageId || !originalMessage) return;
  try {
    const targetChatId = target?.chatId ? String(target.chatId) : null;
    await KV.put('msg-map-' + forwardedMessageId, originalMessage.chat.id.toString(), { expirationTtl: 172800 });
    if (targetChatId) {
      await KV.put(`msg-map-${targetChatId}:${forwardedMessageId}`, originalMessage.chat.id.toString(), { expirationTtl: 172800 });
    }
    await KV.put('orig-map-' + originalMessage.message_id, forwardedMessageId.toString(), { expirationTtl: 172800 });
    if (targetChatId) {
      await KV.put(`orig-map-${originalMessage.message_id}:${targetChatId}`, forwardedMessageId.toString(), { expirationTtl: 172800 });
    }
    // 反查映射：转发消息 ID → 用户原始消息 ID，用于管理员引用回复时让用户看到被引用的原消息
    await KV.put('fwd-orig-' + forwardedMessageId, originalMessage.message_id.toString(), { expirationTtl: 172800 });
    if (target && target.chatId) {
      const locationValue = JSON.stringify({ chat_id: target.chatId, thread_id: target.threadId || null });
      await KV.put('fwd-loc-' + forwardedMessageId, locationValue, { expirationTtl: 172800 });
      await KV.put(`fwd-loc-${targetChatId}:${forwardedMessageId}`, locationValue, { expirationTtl: 172800 });
      // 【表情回应】仅话题模式记录对等坐标（私聊模式不需要 react）。
      // 用户原消息 ↔ 群副本，供 react 镜像互查。
      if (target.label === 'topic') {
        await storeReactionPeers(
          { chat_id: originalMessage.chat.id, message_id: originalMessage.message_id },
          { chat_id: target.chatId, message_id: forwardedMessageId }
        );
      }
    }
  } catch (e) {
    Logger.warn('store_forward_mapping_failed', e, {
      forwardedMessageId,
      originalMessageId: originalMessage.message_id
    });
  }
}

// 【表情回应】记录一对镜像消息的对等坐标（双向），供 message_reaction 镜像时互查。
// a、b 均为 { chat_id, message_id }。任一侧被点表情，都能定位到另一侧的镜像消息。
async function storeReactionPeers(a, b) {
  if (!a || !b || !a.chat_id || !a.message_id || !b.chat_id || !b.message_id) return;
  try {
    await Promise.all([
      KV.put(`react-peer-${a.chat_id}-${a.message_id}`, JSON.stringify(b), { expirationTtl: 172800 }),
      KV.put(`react-peer-${b.chat_id}-${b.message_id}`, JSON.stringify(a), { expirationTtl: 172800 }),
    ]);
  } catch (e) {
    Logger.warn('store_reaction_peers_failed', e, { a, b });
  }
}

async function getReactionPeer(chatId, messageId) {
  return await safeGetJSON(`react-peer-${chatId}-${messageId}`, null);
}

// 【表情回应】处理 message_reaction 更新，将表情镜像到对等消息。
// 方向：
//   - 用户私聊里对 bot 消息点表情 → 镜像到管理员/群里的副本
//   - 群里话题内点表情 → 仅当点表情者是管理员时，镜像给用户（避免群成员表情泄露给用户）
// Telegram 不推送 bot 自己设置的 react，因此不会形成循环。
async function handleMessageReaction(reaction) {
  try {
    const chatId = reaction.chat?.id ? String(reaction.chat.id) : null;
    const messageId = reaction.message_id;
    if (!chatId || !messageId) return;

    // 群组侧：只镜像管理员的表情，忽略其他群成员
    if (GROUP_ID && chatId === GROUP_ID) {
      const reactorId = reaction.user?.id ? String(reaction.user.id) : null;
      if (!reactorId || !isAdmin(reactorId)) {
        Logger.debug('reaction_ignored_non_admin', { chatId, reactorId });
        return;
      }
    }

    const peer = await getReactionPeer(chatId, messageId);
    if (!peer || !peer.chat_id || !peer.message_id) {
      Logger.debug('reaction_peer_not_found', { chatId, messageId });
      return;
    }

    const newReaction = Array.isArray(reaction.new_reaction) ? reaction.new_reaction : [];
    const result = await requestTelegram('setMessageReaction', {
      chat_id: peer.chat_id,
      message_id: peer.message_id,
      reaction: newReaction
    });

    if (!result.ok) {
      Logger.warn('mirror_reaction_failed', { chatId, messageId, peer, description: result.description });
    }
  } catch (e) {
    Logger.error('handle_message_reaction_failed', e);
  }
}

async function notifyForwardFailure(target, result) {
  const recipient = ADMIN_UID || target.chatId;
  const lang = await getUserLang(recipient);
  const hint = target.label === 'topic' ? t(lang, 'forward_failed_topic_hint') : '';
  const errText = result.userMessage || result.description || t(lang, 'err_generic');
  await sendMessage({
    chat_id: recipient,
    text: t(lang, 'forward_failed', { error: errText }) + (hint ? `\n\n${hint}` : '')
  });
}

// 处理访客编辑后的消息
function shouldAttemptCopyFallback(target) {
  return target && target.label === 'topic';
}

async function tryCopySingleMessage(msg, target) {
  const payload = {
    chat_id: target.chatId,
    from_chat_id: msg.chat.id,
    message_id: msg.message_id
  };
  if (target.threadId) payload.message_thread_id = target.threadId;

  const copyReq = await requestTelegram('copyMessage', payload);
  if (copyReq.ok && copyReq.result && copyReq.result.message_id) {
    // 注：copyMessage 返回的是 MessageId（仅含 message_id），无 message_thread_id，
    // 无法校验线程；payload 已带 message_thread_id，由 Telegram 保证投递到正确话题。
    await storeForwardMapping(copyReq.result.message_id, msg, target);
    return { success: true };
  }
  return { success: false, rawResult: copyReq };
}

async function copyMessagesIndividually(messages, target) {
  for (const msg of messages) {
    const payload = {
      chat_id: target.chatId,
      from_chat_id: msg.chat.id,
      message_id: msg.message_id
    };
    if (target.threadId) payload.message_thread_id = target.threadId;

    const copyReq = await requestTelegram('copyMessage', payload);
    if (copyReq.ok && copyReq.result && copyReq.result.message_id) {
      // copyMessage 返回 MessageId（无 message_thread_id），无法校验线程；
      // payload 已带 message_thread_id，由 Telegram 保证投递到正确话题。
      await storeForwardMapping(copyReq.result.message_id, msg, target);
    } else {
      return { success: false, rawResult: copyReq };
    }
  }
  return { success: true };
}

async function handleGuestEditedMessage(message) {
  const origMessageId = message.message_id.toString();
  const chatId = message.chat.id.toString();
  const topicModeEnabled = await isTopicForwardingEnabled();
  const targetChatIds = topicModeEnabled && GROUP_ID ? [GROUP_ID] : ADMIN_ID_LIST;

  for (const targetChatId of targetChatIds) {
    await sendGuestEditNotice(message, chatId, origMessageId, String(targetChatId));
  }
}

async function sendGuestEditNotice(message, chatId, origMessageId, targetChatId) {
  // 查找原始消息转发后的 ID（用于回复引用）
  const forwardedMessageIdRaw = await KV.get(`orig-map-${origMessageId}:${targetChatId}`)
    || await KV.get('orig-map-' + origMessageId);
  let forwardedMessageId = null;
  let forwardLocation = null;
  if (forwardedMessageIdRaw) {
    const numericId = parseInt(forwardedMessageIdRaw, 10);
    forwardedMessageId = Number.isNaN(numericId) ? forwardedMessageIdRaw : numericId;
    const locRaw = await KV.get(`fwd-loc-${targetChatId}:${forwardedMessageIdRaw}`)
      || await KV.get('fwd-loc-' + forwardedMessageIdRaw);
    if (locRaw) {
      try {
        forwardLocation = JSON.parse(locRaw);
      } catch (e) {
        Logger.warn('parse_forward_location_failed', e, { forwardedMessageId: forwardedMessageIdRaw });
      }
    }
  }

  // 查找是否已有编辑提示消息
  const editNoticeKey = `edit-notice:${chatId}:${origMessageId}:${targetChatId}`;
  let existingNotice = null;
  const existingNoticeRaw = await KV.get(editNoticeKey);
  if (existingNoticeRaw) {
    try {
      existingNotice = JSON.parse(existingNoticeRaw);
    } catch (e) {
      existingNotice = { chat_id: targetChatId, message_id: parseInt(existingNoticeRaw, 10) || existingNoticeRaw };
      Logger.warn('parse_edit_notice_failed', e, { editNoticeKey });
    }
  }

  const noticeLang = await getUserLang(ADMIN_UID);
  const editNotice = `✏️ ${escapeHtml(message.text || t(noticeLang, 'edit_no_text'))}`;

  if (existingNotice) {
    // 已有编辑提示，尝试更新
    try {
      const editReq = await requestTelegram('editMessageText', {
        chat_id: existingNotice.chat_id || targetChatId,
        message_id: parseInt(existingNotice.message_id),
        text: editNotice,
        parse_mode: 'HTML'
      });

      if (editReq.ok) {
        // 更新成功
        return;
      }
      // 更新失败（可能消息被删除），继续发送新消息
    } catch (e) {
      Logger.warn('update_edit_hint_failed', e);
      // 继续发送新消息
    }
  }

  // 发送新的编辑提示
  const noticeChatId = forwardLocation?.chat_id || targetChatId;
  const targetThreadId = forwardLocation?.thread_id || null;
  const sendPayload = {
    chat_id: noticeChatId,
    text: editNotice,
    parse_mode: 'HTML'
  };
  const replyToId = forwardedMessageId ? Number(forwardedMessageId) : null;
  if (replyToId) {
    sendPayload.reply_to_message_id = replyToId;
  }
  if (targetThreadId) {
    sendPayload.message_thread_id = targetThreadId;
  }
  const result = await sendMessage(sendPayload);

  // 存储映射关系
  if (result.ok && result.result && result.result.message_id) {
    await KV.put(`msg-map-${noticeChatId}:${result.result.message_id}`, chatId, { expirationTtl: 172800 });
    await KV.put('msg-map-' + result.result.message_id, chatId, { expirationTtl: 172800 });
    // 存储编辑提示消息ID、位置，用于后续更新
    await KV.put(
      editNoticeKey,
      JSON.stringify({
        chat_id: noticeChatId,
        message_id: result.result.message_id,
        thread_id: targetThreadId
      }),
      { expirationTtl: 172800 }
    );
  }
}

// 处理管理员编辑后的消息
async function handleAdminEditedMessage(message) {
  const adminMessageId = message.message_id.toString();
  const adminChatId = message.chat?.id ? String(message.chat.id) : ADMIN_UID;
  const lang = await getUserLang(adminChatId);

  // 查找管理员回复消息的映射关系
  const replyMapData = await KV.get(`admin-reply-map-${adminChatId}:${adminMessageId}`)
    || await KV.get('admin-reply-map-' + adminMessageId);

  if (replyMapData) {
    try {
      const { guestChatId, guestMessageId } = JSON.parse(replyMapData);

      // 【修复】编辑同步时携带格式信息（entities）。加粗/斜体/引用等格式都在
      // message.entities / caption_entities 里，只传纯文本会丢失格式，且当仅改格式、
      // 可见文本未变时 Telegram 会返回 400 "message is not modified"。
      let editReq;
      if (typeof message.text === 'string') {
        editReq = await requestTelegram('editMessageText', {
          chat_id: guestChatId,
          message_id: guestMessageId,
          text: message.text,
          entities: message.entities || undefined
        });
      } else if (typeof message.caption === 'string') {
        // 图片/文件等带文字说明的消息
        editReq = await requestTelegram('editMessageCaption', {
          chat_id: guestChatId,
          message_id: guestMessageId,
          caption: message.caption,
          caption_entities: message.caption_entities || undefined
        });
      } else {
        // 无文本内容（例如仅替换媒体），无法同步编辑
        return;
      }

      if (!editReq.ok) {
        const errorCode = editReq.error_code;
        const desc = (editReq.description || '').toLowerCase();

        // 内容未变化：视为成功，不打扰管理员（常见于仅调整了不可见字符或重复编辑）
        if (desc.includes('message is not modified')) {
          return;
        }

        // 消息已过期或被删除 (错误码 400)
        if (errorCode === 400) {
          await sendMessage({
            chat_id: adminChatId,
            text: t(lang, 'edit_expired')
          });
        } else {
          // 其他错误，只通知管理员编辑失败
          await sendMessage({
            chat_id: adminChatId,
            text: t(lang, 'edit_failed', { error: editReq.description || t(lang, 'err_generic') })
          });
        }
      }
    } catch (e) {
      // 解析映射数据失败
      await sendMessage({
        chat_id: adminChatId,
        text: t(lang, 'edit_process_failed', { error: e.message })
      });
    }
  } else {
    // 未找到映射关系，可能是旧消息或映射已过期
    await sendMessage({
      chat_id: adminChatId,
      text: t(lang, 'edit_no_mapping')
    });
  }
}

// =================================================================
//                      Webhook 设置工具
// =================================================================

async function registerWebhook(event, requestUrl, suffix, secret) {
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
  // 【表情回应】默认的 allowed_updates 不含 message_reaction，必须显式声明才能收到表情事件。
  // 一旦指定 allowed_updates 即为完整替换，因此需列全所有用到的更新类型。
  const allowedUpdates = JSON.stringify([
    'message',
    'edited_message',
    'callback_query',
    'message_reaction',
    'my_chat_member'
  ]);
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret, allowed_updates: allowedUpdates }))).json();

  // 注册 Webhook 成功后设置命令列表
  if ('ok' in r && r.ok) {
    await setBotCommands();
  }

  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2));
}

async function unRegisterWebhook(event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json();
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2));
}

// ========== 本地题库验证回调处理 ==========

// 处理题库答案回调
async function handleQuizCallback(callbackQuery) {
  const userId = String(callbackQuery.from.id);
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  const chatId = callbackQuery.message.chat.id;
  const lang = await getUserLang(userId);

  // 【优化】使用 try/finally 统一管理验证锁的释放，避免分支遗漏导致死锁残留
  let lockAcquired = false;

  try {
    // 【并发保护】尝试获取验证锁
    const lockResult = await tryAcquireVerifyLock(userId);
    if (!lockResult.acquired) {
      const waitTime = Math.ceil(lockResult.lockInfo.remainingMs / 1000);
      return await requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'quiz_lock_wait', { seconds: waitTime }),
        show_alert: true
      });
    }
    lockAcquired = true;

    // 【优化】解析答案索引，严格验证格式
    const parts = data.split(':');
    if (parts.length !== 2) {
      return await requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'quiz_invalid_data'),
        show_alert: true
      });
    }

    const answerIndex = parseInt(parts[1]);
    if (isNaN(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      return await requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'quiz_invalid_option'),
        show_alert: true
      });
    }

    // 【优化】检查验证尝试频率限制
    const attemptLimit = checkRateLimit(userId, 'verifyAttempt');
    if (!attemptLimit.allowed) {
      return await requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'quiz_attempt_rate', { seconds: attemptLimit.retryAfter }),
        show_alert: true
      });
    }

    // 验证答案
    const result = await verifyQuizAnswer(userId, answerIndex, lang);

    if (result.success) {
      // 答案正确，标记用户已验证
      const verifiedKey = 'verified-' + userId;
      await KV.put(verifiedKey, 'true', { expirationTtl: VERIFICATION_TTL });
      memSet(verifiedKey, 'true', 5 * 60 * 1000);
      await cacheApiSet(verifiedKey, 'true', 300);

      const user = callbackQuery.from;
      const userName = user.username || user.first_name || 'Unknown';
      await addVerifiedUser(userId, userName);

      // 缓存用户资料
      await upsertUserProfileFromUpdate(user);

      // 记录验证方式（必须在处理暂存消息之前：暂存转发可能抢先创建话题并发出欢迎卡，
      // 欢迎卡会消费这里暂存的方式并认领通知去重标记）
      const quizVerifyMode = await getVerifyMode();
      const quizMethod = quizVerifyMode === 'both' ? 'both' : 'quiz';
      markPendingVerifyMethod(userId, quizMethod);

      // 处理暂存的消息
      let pendingResult = { forwarded: 0, failed: 0 };
      try {
        pendingResult = await processPendingMessagesAfterVerification(userId);
        Logger.info('local_quiz_verification_success', { userId, pendingForwarded: pendingResult.forwarded });
      } catch (e) {
        Logger.error('process_pending_messages_failed', e, { userId });
      }

      // 构建成功消息
      let successText = t(lang, 'quiz_success_msg');
      if (pendingResult.forwarded > 0) {
        successText = t(lang, 'quiz_success_pending', { count: pendingResult.forwarded });
      }

      // 更新消息为成功状态
      try {
        await requestTelegram('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: successText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        });
      } catch (e) {
        Logger.error('edit_message_text_failed', e, { userId });
      }

      // 发送欢迎消息（如果没有暂存消息转发）
      if (pendingResult.forwarded === 0) {
        try {
          const welcomeMsg = await getConfig(CONFIG_KEYS.WELCOME_MSG);
          if (welcomeMsg) {
            await sendMessage({
              chat_id: userId,
              text: welcomeMsg
            });
          }
        } catch (e) {
          Logger.error('send_welcome_msg_failed', e, { userId });
        }
      }

      // 记录活跃
      try {
        await recordActiveUser(userId);
      } catch (e) {
        Logger.error('record_active_user_failed', e, { userId });
      }

      // 新用户接入通知（按转发模式路由，去重）
      await notifyNewUserVerified(userId, user, quizMethod);

      return await requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: t(lang, 'quiz_success_toast')
      });
    } else {
      // 答案错误
      if (result.reason === 'expired' || result.reason === 'max_attempts') {
        // 题目过期或尝试次数过多，删除按钮
        try {
          await requestTelegram('editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] }
          });
        } catch (e) {
          Logger.error('edit_reply_markup_failed', e, { userId });
        }

        return await requestTelegram('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: result.message,
          show_alert: true
        });
      }

      // 答案错误但还可以继续尝试
      return await requestTelegram('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: result.message,
        show_alert: true
      });
    }
  } catch (e) {
    Logger.error('handle_quiz_callback_failed', e, { userId });
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'quiz_error'),
      show_alert: true
    });
  } finally {
    // 【优化】统一锁释放：无论成功失败、是否提前 return，都会执行
    if (lockAcquired) {
      try {
        await releaseVerifyLock(userId);
      } catch (e) {
        Logger.error('release_lock_failed', e, { userId });
      }
    }
  }
}

// 处理验证模式切换回调
async function handleVerifyModeCallback(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const lang = await getUserLang(callbackQuery.from.id);

  const newMode = data.split(':')[1];

  // 尝试设置新模式
  const success = await setVerifyMode(newMode);

  if (!success) {
    return requestTelegram('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: t(lang, 'verify_mode_switch_failed'),
      show_alert: true
    });
  }

  // 更新菜单显示
  const menu = await generateMainMenu(lang);
  await requestTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: menu.text,
    parse_mode: 'HTML',
    reply_markup: menu.reply_markup
  });

  return requestTelegram('answerCallbackQuery', {
    callback_query_id: callbackQuery.id,
    text: t(lang, 'verify_mode_switched', { mode: getVerifyModeName(newMode, lang) })
  });
}