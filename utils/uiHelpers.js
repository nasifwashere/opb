/**
 * Modern UI components for Discord bot battles
 * Clean, minimal design with professional appearance
 */

function createRoundedHealthBar(current, max, length = 12) {
    const percentage = Math.max(0, current / max);
    const filledBars = Math.round(percentage * length);
    const emptyBars = length - filledBars;
    
    // Create clean health bar without ugly spikes
    let healthBar = '';
    
    if (filledBars > 0) {
        // Clean filled sections using solid blocks
        healthBar += '▰'.repeat(filledBars);
    }
    
    // Empty sections with subtle styling
    if (emptyBars > 0) {
        healthBar += '▱'.repeat(emptyBars);
    }
    
    return healthBar;
}

function createTeamDisplay(team, teamName, showStats = true) {
    if (!team || team.length === 0) {
        return `*No active crew members*`;
    }
    
    let display = '';
    const aliveMembers = team.filter(card => card.currentHp > 0);
    
    aliveMembers.forEach((card, index) => {
        const level = card.level || 1;
        const rank = card.rank || 'C';
        
        // Clean character line
        display += `**${card.name}** • Level ${level} • Rank ${rank}\n`;
        
        // Simple health bar
        const healthBar = createRoundedHealthBar(card.currentHp, card.maxHp || card.hp);
        const percentage = Math.round((card.currentHp / (card.maxHp || card.hp)) * 100);
        display += `${healthBar} ${card.currentHp}/${card.maxHp || card.hp} (${percentage}%)\n`;
        
        // Clean stats
        if (showStats) {
            const power = card.power || card.atk || 100;
            const speed = card.speed || card.spd || 50;
            const hp = card.maxHp || card.hp || 100;
            display += `${power} PWR • ${hp} HP • ${speed} SPD\n`;
        }
        
        if (index < aliveMembers.length - 1) display += '\n';
    });
    
    return display;
}

function createEnemyDisplay(enemies) {
    if (!enemies || enemies.length === 0) {
        return '*No enemies remaining*';
    }
    
    let display = '';
    
    enemies.filter(enemy => enemy.currentHp > 0).forEach((enemy, index) => {
        const rank = enemy.rank || 'C';
        const isBoss = rank === 'A' || rank === 'S' || rank === 'UR';
        const prefix = isBoss ? 'BOSS' : 'Enemy';
        
        // Clean enemy name
        display += `**${enemy.name}** • ${prefix} • Rank ${rank}\n`;
        
        // Simple health bar
        const healthBar = createRoundedHealthBar(enemy.currentHp, enemy.maxHp || enemy.hp);
        const percentage = Math.round((enemy.currentHp / (enemy.maxHp || enemy.hp)) * 100);
        display += `${healthBar} ${enemy.currentHp}/${enemy.maxHp || enemy.hp} (${percentage}%)\n`;
        
        if (index < enemies.filter(e => e.currentHp > 0).length - 1) display += '\n';
    });
    
    return display;
}

function createBattleLogDisplay(battleLog, maxLines = 3) {
    if (!battleLog || battleLog.length === 0) {
        return '*No recent actions*';
    }
    
    const recentActions = battleLog.slice(-maxLines);
    let display = '';
    
    recentActions.forEach(action => {
        // Clean formatting without emojis
        display += `• ${action}\n`;
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
    
    return `**${card.name}** • Level ${level} • Rank ${rank}\n${power} PWR • ${hp} HP • ${speed} SPD`;
}

function createProgressDisplay(current, max, label = 'Progress') {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    const barLength = 10;
    const filledBars = Math.round((percentage / 100) * barLength);
    const emptyBars = barLength - filledBars;
    
    const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(emptyBars);
    return `**${label}**: ${progressBar} ${Math.round(percentage)}%`;
}

// Returns a random integer between min (inclusive) and max (inclusive)
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    getRandomInt
};