function calculateReward(voteCount){
    if (voteCount === 0) return 2;
    if (voteCount === 1) return 1.5;
    if (voteCount === 2) return 1.25;
    if (voteCount === 3) return 1.1;
    if (voteCount === 4) return 1.05;
    if (voteCount === 5) return 1;
    return Math.max(0.5, 1 - (voteCount - 2) * 0.01);
}

module.exports = {
    calculateReward
}