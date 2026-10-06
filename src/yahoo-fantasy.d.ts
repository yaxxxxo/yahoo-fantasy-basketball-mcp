declare module "yahoo-fantasy" {
  interface LeagueResource {
    meta(leagueKey: string): Promise<any>;
    settings(leagueKey: string): Promise<any>;
    standings(leagueKey: string): Promise<any>;
    scoreboard(leagueKey: string, week?: number): Promise<any>;
    teams(leagueKey: string): Promise<any>;
    players(leagueKey: string, options?: Record<string, unknown>): Promise<any>;
    transactions: {
      add(leagueKey: string, playerKey: string, dropPlayerKey?: string): Promise<any>;
      drop(leagueKey: string, playerKey: string): Promise<any>;
    };
  }

  interface TeamResource {
    roster(teamKey: string): Promise<any>;
  }

  interface PlayerResource {
    stats(playerKey: string): Promise<any>;
  }

  interface PlayersCollection {
    leagues(
      leagueKeys: string | string[],
      filters?: Record<string, unknown>,
      subresources?: string | string[]
    ): Promise<any>;
    fetch(playerKeys: string | string[]): Promise<any>;
  }

  class YahooFantasy {
    constructor(clientId: string, clientSecret: string);
    setUserToken(token: string): void;
    league: LeagueResource;
    team: TeamResource;
    player: PlayerResource;
    players: PlayersCollection;
  }

  export default YahooFantasy;
}
