use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{error::RoamSafeError, state::Trip};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeTripArgs {
    pub trip_id: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub daily_limit: u64,
    pub max_tx_amount: u64,
    pub emergency_reserve: u64,
    pub recovery_authority: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: InitializeTripArgs)]
pub struct InitializeTrip<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = owner,
        space = 8 + Trip::INIT_SPACE,
        seeds = [b"trip", owner.key().as_ref(), &args.trip_id.to_le_bytes()],
        bump
    )]
    pub trip: Account<'info, Trip>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = trip
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeTrip>, args: InitializeTripArgs) -> Result<()> {
    require!(args.end_ts > args.start_ts, RoamSafeError::InvalidTripWindow);
    require!(args.daily_limit > 0, RoamSafeError::InvalidLimit);
    require!(args.max_tx_amount > 0, RoamSafeError::InvalidLimit);

    let trip = &mut ctx.accounts.trip;
    trip.owner = ctx.accounts.owner.key();
    trip.recovery_authority = if args.recovery_authority == Pubkey::default() {
        ctx.accounts.owner.key()
    } else {
        args.recovery_authority
    };
    trip.mint = ctx.accounts.mint.key();
    trip.trip_id = args.trip_id;
    trip.start_ts = args.start_ts;
    trip.end_ts = args.end_ts;
    trip.daily_limit = args.daily_limit;
    trip.max_tx_amount = args.max_tx_amount;
    trip.emergency_reserve = args.emergency_reserve;
    trip.spent_today = 0;
    trip.total_spent = 0;
    trip.day_window_start = args.start_ts;
    trip.locked = false;
    trip.bump = ctx.bumps.trip;

    emit!(TripCreated {
        owner: trip.owner,
        trip: trip.key(),
        trip_id: trip.trip_id,
        start_ts: trip.start_ts,
        end_ts: trip.end_ts,
    });

    Ok(())
}

#[event]
pub struct TripCreated {
    pub owner: Pubkey,
    pub trip: Pubkey,
    pub trip_id: u64,
    pub start_ts: i64,
    pub end_ts: i64,
}
