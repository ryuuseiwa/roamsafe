use anchor_lang::prelude::*;

use crate::{error::RoamSafeError, state::Trip};

#[derive(Accounts)]
pub struct EmergencyLock<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub trip: Account<'info, Trip>,
}

pub fn handler(ctx: Context<EmergencyLock>) -> Result<()> {
    let trip = &mut ctx.accounts.trip;
    require!(
        trip.is_authorized_recovery(ctx.accounts.authority.key()),
        RoamSafeError::UnauthorizedRecoveryAuthority
    );

    trip.locked = true;

    emit!(TripEmergencyLocked {
        trip: trip.key(),
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}

#[event]
pub struct TripEmergencyLocked {
    pub trip: Pubkey,
    pub authority: Pubkey,
}
