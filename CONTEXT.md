# Yahoo Fantasy Basketball Assistant

Gives an AI assistant a manager's view of one Yahoo head-to-head categories basketball league in the current season, so it can answer questions about the week's matchup and who to pick up.

## Language

### League

**League**:
A single Yahoo fantasy basketball competition in the current season, scored head-to-head by categories.
_Avoid_: Competition, group

**Default League**:
The league a request refers to when none is named: the only league the manager plays in this season, or the one they have chosen when there are several.
_Avoid_: Current league, active league

**Manager**:
The person whose Yahoo login the assistant is acting for.
_Avoid_: User, owner, account

**My Team**:
The team the manager owns in a league, known from their login rather than configured.
_Avoid_: Your team, default team, user team

**Category**:
One of the statistics a league scores on; each category is won, lost, or tied separately in a matchup.
_Avoid_: Stat (when meaning a scored statistic), metric

**Percentage Category**:
A category expressed as makes over attempts, such as field-goal percentage, which is combined by summing makes and attempts, never by averaging percentages.
_Avoid_: Ratio stat, rate stat

### Week

**Week**:
A league scoring period, the span over which one matchup is decided.
_Avoid_: Round, gameweek

**Matchup**:
The head-to-head contest between two teams over one week.
_Avoid_: Game (that word means an NBA game), fixture

**Banked Totals**:
The category totals a team has already accumulated in the current week.
_Avoid_: Current score, actuals

**Games Remaining**:
The number of NBA games a player's real team still has to play in the current week.
_Avoid_: Schedule, games left

**Averages Window**:
The span of past games a player's per-game averages are drawn from; last 30 days unless the manager chooses otherwise, and last season's averages while the new season is too young.
_Avoid_: Sort type, time window, sample

### Roster

**Active Slot**:
A roster position whose player's statistics count toward the matchup on a given day.
_Avoid_: Starting slot, lineup spot

**Unavailable Player**:
A rostered player in an injured-list slot or ruled out, who contributes nothing to a projection.
_Avoid_: Injured player, inactive

**Free Agent**:
A player not on any team in the league and available to pick up.
_Avoid_: Available player, waiver player

### Analysis

**Projection**:
A forecast of a matchup's final category totals for both teams: banked totals plus each available player's averages over their games remaining, with no day counting more players than there are active slots.
_Avoid_: Prediction, forecast, estimate

**Projected Result**:
The win, loss, or tie a projection implies for each category, and the resulting category score.
_Avoid_: Predicted score, outlook

**Close Category**:
A category whose projected margin is small enough that a pickup could change its result.
_Avoid_: Swing category, toss-up

**Stream**:
A free agent picked up for their games remaining this week, valued by what they are expected to add in the target categories.
_Avoid_: Pickup recommendation, streamer, waiver add

**Target Categories**:
The categories a stream is meant to help: the close categories of the current projection unless the manager names others.
_Avoid_: Sort category, needs
