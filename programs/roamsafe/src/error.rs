use anchor_lang::prelude::*;

#[error_code]
pub enum RoamSafeError {
    #[msg("Trip end time must be after the start time.")]
    InvalidTripWindow,
    #[msg("Spending limits must be greater than zero.")]
    InvalidLimit,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("The trip is not currently active.")]
    TripNotActive,
    #[msg("The trip wallet is emergency-locked.")]
    TripLocked,
    #[msg("This payment exceeds the maximum single-transaction amount.")]
    MaxTransactionExceeded,
    #[msg("This payment would exceed the active daily spending limit.")]
    DailyLimitExceeded,
    #[msg("This payment would consume the protected emergency reserve.")]
    EmergencyReserveViolation,
    #[msg("The vault does not contain enough tokens.")]
    InsufficientVaultBalance,
    #[msg("The signer is not authorized for this recovery action.")]
    UnauthorizedRecoveryAuthority,
    #[msg("Funds can only be recovered after the trip ends or after emergency lock.")]
    RecoveryNotAllowed,
    #[msg("The trip can only be closed after it ends or is emergency-locked.")]
    CloseNotAllowed,
    #[msg("Recover all token funds before closing the trip.")]
    VaultNotEmpty,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}
