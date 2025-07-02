/**
 * Enhanced UI components for Discord bot
 * Provides consistent visual design across all commands
 */

function createEnhancedHealthBar(current, max, barLength = 15) {
    const percentage = Math.max(0, current / max);
    const filledBars = Math.round(percentage * barLength);
    const emptyBars = barLength - filledBars;
    
    // Use different colors based on health percentage
    let healthEmoji;
    let barColor;
    if (percentage > 0.6) {
        healthEmoji = '🟢';
        barColor = '🟩';
    } else if (percentage > 0.3) {
        healthEmoji = '🟡';
        barColor = '🟨';
    } else {
        healthEmoji = '🔴';
        barColor = '🟥';
    }
    
    const healthBar = barColor.repeat(filledBars) + '⬛'.repeat(emptyBars);
    return `${healthEmoji} ${healthBar} ${current}/${max}`;
}

function createTeamDisplay(team, teamName, showStats = true) {
    if (!team || team.length === 0) {
        return `**═══${teamName}'s Team═══**\n*No active cards*`;
    }
    
    let display = `**═══${teamName}'s Team═══**\n`;
    
    team.filter(card => card.currentHp > 0).forEach((card, index) => {
        const healthBar = createEnhancedHealthBar(card.currentHp, card.maxHp || card.hp);
        const level = card.level || 1;
        const rank = card.rank || 'C';
        
        display += `\n🔸 **${card.name}** | Lv. ${level} **${rank}**\n`;
        display += `${healthBar}\n`;
        
        if (showStats) {
            const power = card.power || card.atk || 100;
            const speed = card.speed || card.spd || 50;
            const hp = card.maxHp || card.hp || 100;
            display += `⚔️ ${power} PWR • ❤️ ${hp} HP • ⚡ ${speed} SPD\n`;
        }
    });
    
    return display;
}

function createEnemyDisplay(enemies) {
    if (!enemies || enemies.length === 0) {
        return '**═══Enemies═══**\n*No enemies*';
    }
    
    let display = '**═══Enemies═══**\n';
    
    enemies.filter(enemy => enemy.currentHp > 0).forEach((enemy, index) => {
        const healthBar = createEnhancedHealthBar(enemy.currentHp, enemy.maxHp || enemy.hp);
        const rank = enemy.rank || 'C';
        
        display += `\n💀 **${enemy.name}** | **${rank}** Rank\n`;
        display += `${healthBar}\n`;
    });
    
    return display;
}

function createBattleLogDisplay(battleLog, maxLines = 3) {
    if (!battleLog || battleLog.length === 0) {
        return '**═══Battle Log═══**\n*No actions yet*';
    }
    
    return `**═══Battle Log═══**\n${battleLog.slice(-maxLines).join('\n')}`;
}

function createStatsDisplay(card) {
    const power = card.power || card.atk || 100;
    const hp = card.maxHp || card.hp || 100;
    const speed = card.speed || card.spd || 50;
    const rank = card.rank || 'C';
    const level = card.level || 1;
    
    return `**${card.name}** | Lv. ${level} **${rank}**\n⚔️ ${power} PWR • ❤️ ${hp} HP • ⚡ ${speed} SPD`;
}

function createProgressDisplay(current, max, label = 'Progress') {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    const barLength = 10;
    const filledBars = Math.round((percentage / 100) * barLength);
    const emptyBars = barLength - filledBars;
    
    const progressBar = '🟦'.repeat(filledBars) + '⬜'.repeat(emptyBars);
    return `**${label}**: ${progressBar} ${Math.round(percentage)}%`;
}

module.exports = {
    createEnhancedHealthBar,
    createTeamDisplay,
    createEnemyDisplay,
    createBattleLogDisplay,
    createStatsDisplay,
    createProgressDisplay
};