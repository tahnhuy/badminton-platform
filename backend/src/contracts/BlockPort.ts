export interface BlockPort {
  isBlockedEitherWay(userAId: number, userBId: number): Promise<boolean>;
}

