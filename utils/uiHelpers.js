/**
 * Enhanced UI components for Discord bot
 * Provides consistent visual design across all commands
 */

function createAdvancedHealthBar(current, max, barLength = 20) {
    const percentage = Math.max(0, current / max);
    const filledBars = Math.round(percentage * barLength);
    const emptyBars = barLength - filledBars;
    
    // Enhanced color system based on health percentage
    let barColor, bgColor;
    if (percentage > 0.75) {
        barColor = '🟢'; // Full health - green
        bgColor = '⬛';
    } else if (percentage > 0.5) {
        barColor = '�'; // Medium health - yellow  
        bgColor = '⬛';
    } else if (percentage > 0.25) {
        barColor = '�'; // Low health - orange
        bgColor = '⬛';
    } else {
        barColor = '🔴'; // Critical health - red
        bgColor = '⬛';
    }
    
    const healthBar = barColor.repeat(filledBars) + bgColor.repeat(emptyBars);
    const percentText = Math.round(percentage * 100);
    
    return `${healthBar} ${current}/${max} (${percentText}%)`;
}

function createProfessionalTeamDisplay(team, teamName, showWinStreak = false) {
    if (!team || team.length === 0) {
        return `\`\`\`\n═══ ${teamName.toUpperCase()} ═══\n     No Active Crew\n\`\`\``;
    }
    
    let display = `\`\`\`ansi\n`;
    display += `\u001b[1;36m═══ ${teamName.toUpperCase()} ═══\u001b[0m\n\n`;
    
    const aliveMembers = team.filter(card => card.currentHp > 0);
    
    aliveMembers.forEach((card, index) => {
        const healthPercentage = (card.currentHp / (card.maxHp || card.hp)) * 100;
        const level = card.level || 1;
        const rank = card.rank || 'C';
        
        // Color coding based on health
        let nameColor = '\u001b[1;32m'; // Green
        if (healthPercentage < 75) nameColor = '\u001b[1;33m'; // Yellow
        if (healthPercentage < 50) nameColor = '\u001b[1;31m'; // Red
        if (healthPercentage < 25) nameColor = '\u001b[1;35m'; // Purple (critical)
        
        display += `${nameColor}● ${card.name}\u001b[0m | Lv.${level} ${rank}\n`;
        
        // Health bar visualization
        const barLength = 15;
        const filledBars = Math.round((healthPercentage / 100) * barLength);
        const emptyBars = barLength - filledBars;
        
        let barColor = '\u001b[42m'; // Green background
        if (healthPercentage < 75) barColor = '\u001b[43m'; // Yellow
        if (healthPercentage < 50) barColor = '\u001b[41m'; // Red
        if (healthPercentage < 25) barColor = '\u001b[45m'; // Purple
        
        const healthBar = barColor + ' '.repeat(filledBars) + '\u001b[0m' + 
                         '\u001b[40m' + ' '.repeat(emptyBars) + '\u001b[0m';
        
        display += `${healthBar} ${card.currentHp}/${card.maxHp || card.hp}\n`;
        
        // Stats line
        const power = card.power || card.atk || 100;
        const speed = card.speed || card.spd || 50;
        const hp = card.maxHp || card.hp || 100;
        
        display += `\u001b[90m⚔️${power} PWR • ❤️${hp} HP • ⚡${speed} SPD\u001b[0m\n`;
        
        if (index < aliveMembers.length - 1) display += '\n';
    });
    
    // Team stats summary
    const totalPower = aliveMembers.reduce((sum, card) => sum + (card.power || card.atk || 100), 0);
    const totalHP = aliveMembers.reduce((sum, card) => sum + (card.currentHp || 0), 0);
    const maxHP = aliveMembers.reduce((sum, card) => sum + (card.maxHp || card.hp || 100), 0);
    
    display += `\n\u001b[1;34m━━━━━━━━━━━━━━━━━━━━\u001b[0m\n`;
    display += `\u001b[1;37mTeam: ${totalPower} PWR | ${totalHP}/${maxHP} HP\u001b[0m\n`;
    
    if (showWinStreak) {
        display += `\u001b[1;33mWin Streak: 16\u001b[0m\n`;
    }
    
    display += `\`\`\``;
    
    return display;
}

function createBattleStatusDisplay(battleState, turn, currentPlayer) {
    let display = `\`\`\`ansi\n`;
    display += `\u001b[1;35m╔══════════════════════════════╗\u001b[0m\n`;
    display += `\u001b[1;35m║\u001b[0m        \u001b[1;37mBATTLE STATUS\u001b[0m        \u001b[1;35m║\u001b[0m\n`;
    display += `\u001b[1;35m╚══════════════════════════════╝\u001b[0m\n\n`;
    
    display += `\u001b[1;36mTurn:\u001b[0m ${turn}\n`;
    display += `\u001b[1;36mCurrent:\u001b[0m ${currentPlayer}\n`;
    
    if (battleState && battleState.userBoosts) {
        const boosts = Object.keys(battleState.userBoosts);
        if (boosts.length > 0) {
            display += `\u001b[1;33mActive Boosts:\u001b[0m\n`;
            boosts.forEach(boost => {
                const duration = battleState.userBoosts[boost].duration || 0;
                display += `  • ${boost}: ${duration} turns\n`;
            });
        }
    }
    
    display += `\`\`\``;
    return display;
}

function createEnemyDisplay(enemies) {
    if (!enemies || enemies.length === 0) {
        return `\`\`\`\n═══ ENEMIES ═══\n   No Enemies\n\`\`\``;
    }
    
    let display = `\`\`\`ansi\n`;
    display += `\u001b[1;31m═══ ENEMIES ═══\u001b[0m\n\n`;
    
    enemies.filter(enemy => enemy.currentHp > 0).forEach((enemy, index) => {
        const healthPercentage = (enemy.currentHp / (enemy.maxHp || enemy.hp)) * 100;
        const rank = enemy.rank || 'C';
        
        // Enemy name with threat level color
        let threatColor = '\u001b[1;31m'; // Red (dangerous)
        if (healthPercentage < 50) threatColor = '\u001b[1;33m'; // Yellow (weakened)
        if (healthPercentage < 25) threatColor = '\u001b[1;32m'; // Green (nearly defeated)
        
        display += `${threatColor}💀 ${enemy.name}\u001b[0m | Rank ${rank}\n`;
        
        // Enemy health bar
        const barLength = 15;
        const filledBars = Math.round((healthPercentage / 100) * barLength);
        const emptyBars = barLength - filledBars;
        
        const healthBar = '\u001b[41m' + ' '.repeat(filledBars) + '\u001b[0m' + 
                         '\u001b[40m' + ' '.repeat(emptyBars) + '\u001b[0m';
        
        display += `${healthBar} ${enemy.currentHp}/${enemy.maxHp || enemy.hp}\n`;
        
        if (index < enemies.filter(e => e.currentHp > 0).length - 1) display += '\n';
    });
    
    display += `\`\`\``;
    return display;
}

function createBattleLogDisplay(battleLog, maxLines = 4) {
    if (!battleLog || battleLog.length === 0) {
        return `\`\`\`\n══ BATTLE LOG ══\n  No actions yet\n\`\`\``;
    }
    
    let display = `\`\`\`ansi\n`;
    display += `\u001b[1;37m══ BATTLE LOG ══\u001b[0m\n\n`;
    
    const recentActions = battleLog.slice(-maxLines);
    recentActions.forEach(action => {
        // Color code different action types
        if (action.includes('attacks')) {
            display += `\u001b[1;31m⚔️\u001b[0m ${action}\n`;
        } else if (action.includes('defeated')) {
            display += `\u001b[1;35m💀\u001b[0m ${action}\n`;
        } else if (action.includes('healed')) {
            display += `\u001b[1;32m❤️\u001b[0m ${action}\n`;
        } else {
            display += `\u001b[90m•\u001b[0m ${action}\n`;
        }
    });
    
    display += `\`\`\``;
    return display;
}

function createEnhancedHealthBar(current, max, barLength = 15) {
    return createAdvancedHealthBar(current, max, barLength);
}

function createTeamDisplay(team, teamName, showStats = true) {
    return createProfessionalTeamDisplay(team, teamName, false);
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
    createProgressDisplay,
    createAdvancedHealthBar,
    createProfessionalTeamDisplay,
    createBattleStatusDisplay
};