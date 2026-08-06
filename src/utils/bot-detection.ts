const BOT_PATTERN = /wget|ahrefsbot|curl|bot|crawler|spider|urllib|bitdiscovery|\+https:\/\/|googlebot/i;

export function isBot(userAgent: string): boolean {
    return BOT_PATTERN.test(userAgent);
}
