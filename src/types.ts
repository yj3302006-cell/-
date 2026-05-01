
export interface CampaignData {
  CampaignName?: string;
  TotalAmount?: number;
  GoalAmount?: number;
  Percentage?: number;
  Goal?: number;
}

export interface GroupData {
  ID: string;
  GroupName: string;
  TotalAmount: number;
  Goal: number;
  Percentage?: number;
  IsGeneral?: boolean;
}

export interface RewardData {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  price: number;
  code?: string;
  image?: string;
  supplierId?: string;
  inDisplay?: boolean;
}

export interface BonusData {
  id: string;
  name: string;
  description: string;
  minPercentage: number;
  minGoal?: number;
  discountValue?: number;
}

export interface SupplierData {
  id: string;
  name: string;
  email: string;
}

export interface ClaimData {
  id: string;
  fundraiserId: string;
  fundraiserName: string;
  rewardId: string;
  rewardName: string;
  rewardCode?: string;
  type: 'reward' | 'bonus';
  status: 'pending' | 'completed' | 'cancelled';
  paidInCash: boolean;
  amountToPay: number;
  isPaid?: boolean;
  uid: string;
  userEmail?: string;
  updatedBy?: string;
  updatedAt: string;
  date?: string;
}

export interface CartItem {
  reward: RewardData | BonusData;
  type: 'reward' | 'bonus';
  paidInCash: boolean;
  amountToPay: number;
  isPaid?: boolean;
}
