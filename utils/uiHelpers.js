/**
 * Clean UI components for Discord bot battles
 * Using Discord embeds instead of colorful code blocks
 */

// Character icons for different ranks and types
const CHARACTER_ICONS = {
    'C': '🔵',
    'B': '🟢', 
    'A': '🟡',
    'S': '🔴',
    'UR': '🟣',
    'enemy': '⚫',
    'boss': '🔴'
};

function createRoundedHealthBar(current, max, length = 12) {
    const percentage = Math.max(0, current / max);
    const filledBars = Math.round(percentage * length);
    const emptyBars = length - filledBars;
    
    // Create rounded health bar with proper ends
    let healthBar = '';
    
    if (filledBars > 0) {
        // Rounded start
        healthBar += '◀';
        // Middle sections
        if (filledBars > 2) {
            healthBar += '█'.repeat(filledBars - 2);
        }
        // Rounded end (if more than 1 filled)
        if (filledBars > 1) {
            healthBar += '▶';
        }
    }
    
    // Empty sections
    healthBar += '░'.repeat(emptyBars);
    
    return healthBar;
}

function createTeamDisplay(team, teamName, showStats = true) {
    if (!team || team.length === 0) {
        return `**${teamName}'s Team**\n*No active crew members*`;
    }
    
    let display = '';
    const aliveMembers = team.filter(card => card.currentHp > 0);
    
    aliveMembers.forEach((card, index) => {
        const level = card.level || 1;
        const rank = card.rank || 'C';
        const icon = CHARACTER_ICONS[rank] || CHARACTER_ICONS['C'];
        
        // Character line with circular icon
        display += `${icon} **${card.name}** | Lv.${level} ${rank}\n`;
        
        // Health bar with rounded ends
        const healthBar = createRoundedHealthBar(card.currentHp, card.maxHp || card.hp);
        const percentage = Math.round((card.currentHp / (card.maxHp || card.hp)) * 100);
        display += `${healthBar} ${card.currentHp}/${card.maxHp || card.hp} (${percentage}%)\n`;
        
        // Stats (simplified)
        if (showStats) {
            const power = card.power || card.atk || 100;
            const speed = card.speed || card.spd || 50;
            const hp = card.maxHp || card.hp || 100;
            display += `⚔️ ${power} • ❤️ ${hp} • ⚡ ${speed}\n`;
        }
        
        if (index < aliveMembers.length - 1) display += '\n';
    });
    
    return display;
}

function createEnemyDisplay(enemies) {
    if (!enemies || enemies.length === 0) {
        return '**Enemies**\n*No enemies remaining*';
    }
    
    let display = '';
    
    enemies.filter(enemy => enemy.currentHp > 0).forEach((enemy, index) => {
        const rank = enemy.rank || 'C';
        const isBoss = rank === 'A' || rank === 'S' || rank === 'UR';
        const icon = isBoss ? CHARACTER_ICONS['boss'] : CHARACTER_ICONS['enemy'];
        
        // Enemy name with icon
        display += `${icon} **${enemy.name}** | Rank ${rank}\n`;
        
        // Health bar with rounded ends
        const healthBar = createRoundedHealthBar(enemy.currentHp, enemy.maxHp || enemy.hp);
        const percentage = Math.round((enemy.currentHp / (enemy.maxHp || enemy.hp)) * 100);
        display += `${healthBar} ${enemy.currentHp}/${enemy.maxHp || enemy.hp} (${percentage}%)\n`;
        
        if (index < enemies.filter(e => e.currentHp > 0).length - 1) display += '\n';
    });
    
    return display;
}

function createBattleLogDisplay(battleLog, maxLines = 3) {
    if (!battleLog || battleLog.length === 0) {
        return '**Recent Actions**\n*No actions yet*';
    }
    
    const recentActions = battleLog.slice(-maxLines);
    let display = '';
    
    recentActions.forEach(action => {
        // Simple formatting without excessive colors
        if (action.includes('attacks')) {
            display += `⚔️ ${action}\n`;
        } else if (action.includes('defeated')) {
            display += `💀 ${action}\n`;
        } else if (action.includes('healed')) {
            display += `❤️ ${action}\n`;
        } else {
            display += `• ${action}\n`;
        }
    });
    
    return display.trim();
}

function createBattleStatusDisplay(battleState, turn, currentPlayer) {
    let display = `**Turn:** ${turn}\n**Current:** ${currentPlayer}\n`;
    
    if (battleState && battleState.userBoosts) {
        const boosts = Object.keys(battleState.userBoosts);
        if (boosts.length > 0) {
            display += `\n**Active Boosts:**\n`;
            boosts.forEach(boost => {
                const duration = battleState.userBoosts[boost].duration || 0;
                const boostName = boost.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                display += `• ${boostName}: ${duration} turns\n`;
            });
        }
    }
    
    return display.trim();
}

// Legacy functions for compatibility
function createAdvancedHealthBar(current, max, barLength = 12) {
    return createRoundedHealthBar(current, max, barLength);
}

function createEnhancedHealthBar(current, max, barLength = 12) {
    return createRoundedHealthBar(current, max, barLength);
}

function createProfessionalTeamDisplay(team, teamName, showWinStreak = false) {
    return createTeamDisplay(team, teamName, true);
}

function createStatsDisplay(card) {
    const power = card.power || card.atk || 100;
    const hp = card.maxHp || card.hp || 100;
    const speed = card.speed || card.spd || 50;
    const rank = card.rank || 'C';
    const level = card.level || 1;
    const icon = CHARACTER_ICONS[rank] || CHARACTER_ICONS['C'];
    
    return `${icon} **${card.name}** | Lv. ${level} **${rank}**\n⚔️ ${power} PWR • ❤️ ${hp} HP • ⚡ ${speed} SPD`;
}

function createProgressDisplay(current, max, label = 'Progress') {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    const barLength = 10;
    const filledBars = Math.round((percentage / 100) * barLength);
    const emptyBars = barLength - filledBars;
    
    const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
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
    createBattleStatusDisplay,
    createRoundedHealthBar,
    CHARACTER_ICONS
};