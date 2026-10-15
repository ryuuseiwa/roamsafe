use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("9d1YyXHPkycnLJ2TCBnGGsiZ5kuZht8yN1TG9JSJmbYf");

#[program]
pub mod roamsafe {
    use super::*;

    pub fn initialize_trip(
        ctx: Context<InitializeTrip>,
        args: InitializeTripArgs,
    ) -> Result<()> {
        instructions::initialize_trip::handler(ctx, args)
    }

    pub fn fund_trip(ctx: Context<FundTrip>, amount: u64) -> Result<()> {
        instructions::fund_trip::handler(ctx, amount)
    }

    pub fn spend_from_trip(ctx: Context<SpendFromTrip>, amount: u64) -> Result<()> {
        instructions::spend_from_trip::handler(ctx, amount)
    }

    pub fn emergency_lock(ctx: Context<EmergencyLock>) -> Result<()> {
        instructions::emergency_lock::handler(ctx)
    }

    pub fn recover_remaining_funds(ctx: Context<RecoverRemainingFunds>) -> Result<()> {
        instructions::recover_remaining_funds::handler(ctx)
    }

    pub fn close_trip(ctx: Context<CloseTrip>) -> Result<()> {
        instructions::close_trip::handler(ctx)
    }
}
