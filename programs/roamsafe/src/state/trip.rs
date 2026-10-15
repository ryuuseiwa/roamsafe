use anchor_lang::prelude::*;
use crate::error::RoamSafeError;

#[account]
#[derive(InitSpace)]
pub struct Trip {
    pub owner: Pubkey,
    pub recovery_authority: Pubkey,
    pub mint: Pubkey,
    pub trip_id: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub daily_limit: u64,
    pub max_tx_amount: u64,
    pub emergency_reserve: u64,
    pub spent_today: u64,
    pub total_spent: u64,
    pub day_window_start: i64,
    pub locked: bool,
    pub bump: u8,
}

pub struct SpendApproval {
    pub spent_today: u64,
    pub total_spent: u64,
    pub day_window_start: i64,
}

impl Trip {
    pub const DAY_SECONDS: i64 = 86_400;

    pub fn is_authorized_recovery(&self, signer: Pubkey) -> bool {
        signer == self.owner || signer == self.recovery_authority
    }

    // Evaluate everything before the CPI. No state changes on a rejected payment.
    // A new 24-hour window starts at the first successful payment after expiry.
    pub fn approve_spend(&self, now: i64, amount: u64, balance: u64) -> Result<SpendApproval> {
        require!(amount > 0, RoamSafeError::InvalidAmount);
        require!(!self.locked, RoamSafeError::TripLocked);
        require!(now >= self.start_ts && now <= self.end_ts, RoamSafeError::TripNotActive);
        require!(amount <= self.max_tx_amount, RoamSafeError::MaxTransactionExceeded);
        let elapsed = now.saturating_sub(self.day_window_start);
        let reset = elapsed >= Self::DAY_SECONDS;
        let spent_today = (if reset { 0 } else { self.spent_today })
            .checked_add(amount).ok_or(RoamSafeError::ArithmeticOverflow)?;
        require!(spent_today <= self.daily_limit, RoamSafeError::DailyLimitExceeded);
        require!(balance >= amount, RoamSafeError::InsufficientVaultBalance);
        require!(balance - amount >= self.emergency_reserve, RoamSafeError::EmergencyReserveViolation);
        let total_spent = self.total_spent.checked_add(amount).ok_or(RoamSafeError::ArithmeticOverflow)?;
        Ok(SpendApproval {
            spent_today,
            total_spent,
            day_window_start: if reset { now } else { self.day_window_start },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn trip() -> Trip {
        Trip {
            owner: Pubkey::new_unique(), recovery_authority: Pubkey::new_unique(),
            mint: Pubkey::new_unique(), trip_id: 1, start_ts: 100, end_ts: 200_000,
            daily_limit: 150, max_tx_amount: 100, emergency_reserve: 200,
            spent_today: 105, total_spent: 105, day_window_start: 100,
            locked: false, bump: 255,
        }
    }
    fn fails(t: &Trip, now: i64, amount: u64, balance: u64, code: &str) {
        let err = t.approve_spend(now, amount, balance).err().expect("must reject");
        assert!(err.to_string().contains(code), "{err}");
    }
    #[test] fn boundaries_and_reserve_are_inclusive() {
        let t = trip();
        assert_eq!(t.approve_spend(100, 45, 245).unwrap().spent_today, 150);
        assert!(t.approve_spend(t.end_ts, 100, 300).is_ok());
    }
    #[test] fn daily_limit_and_maximum_are_distinct() {
        let t = trip();
        fails(&t, 101, 101, 1000, "MaxTransactionExceeded");
        fails(&t, 101, 46, 1000, "DailyLimitExceeded");
    }
    #[test] fn reserve_and_insufficient_balance_are_distinct() {
        let t = trip();
        fails(&t, 101, 1, 200, "EmergencyReserveViolation");
        fails(&t, 101, 1, 0, "InsufficientVaultBalance");
    }
    #[test] fn dates_and_zero_amount() {
        let t = trip();
        fails(&t, 99, 1, 1000, "TripNotActive");
        fails(&t, 200_001, 1, 1000, "TripNotActive");
        fails(&t, 101, 0, 1000, "InvalidAmount");
    }
    #[test] fn lock_cannot_be_bypassed_by_window_reset() {
        let mut t = trip(); t.locked = true;
        fails(&t, 100_000, 1, 1000, "TripLocked");
    }
    #[test] fn reset_at_exactly_twenty_four_hours() {
        let t = trip();
        fails(&t, 86_499, 100, 1000, "DailyLimitExceeded");
        let approved = t.approve_spend(86_500, 100, 1000).unwrap();
        assert_eq!(approved.spent_today, 100);
        assert_eq!(approved.total_spent, 205);
        assert_eq!(approved.day_window_start, 86_500);
        assert_eq!(t.spent_today, 105);
    }
    #[test] fn checked_overflows() {
        let mut t = trip();
        t.total_spent = u64::MAX;
        fails(&t, 101, 1, 1000, "ArithmeticOverflow");
        t.spent_today = u64::MAX;
        fails(&t, 101, 1, 1000, "ArithmeticOverflow");
    }
    #[test] fn authorized_guardian_cannot_be_any_signer() {
        let t = trip();
        assert!(t.is_authorized_recovery(t.owner));
        assert!(t.is_authorized_recovery(t.recovery_authority));
        assert!(!t.is_authorized_recovery(Pubkey::new_unique()));
    }
}
