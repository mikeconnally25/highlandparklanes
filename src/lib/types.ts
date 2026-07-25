export type UserRole = "member" | "staff";

export type CouponStatus = "active" | "redeemed" | "expired";

export type User = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

export type Coupon = {
  id: number;
  userId: number;
  code: string;
  weekStart: string;
  games: number;
  status: CouponStatus;
  createdAt: string;
  redeemedAt: string | null;
  redeemedByStaffId: number | null;
};

export type CouponWithMember = Coupon & {
  memberName: string;
  memberEmail: string;
  redeemedByName: string | null;
};

export type WeekStatusRow = {
  memberId: number;
  memberName: string;
  memberEmail: string;
  weekStart: string;
  redeemedThisWeek: boolean;
  coupon: CouponWithMember | null;
};

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};
