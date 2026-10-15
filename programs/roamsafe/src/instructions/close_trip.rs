use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount};

use crate::{error::RoamSafeError, state::Trip};

#[derive(Accounts)]
pub struct CloseTrip<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [b"trip", owner.key().as_ref(), &trip.trip_id.to_le_bytes()],
        bump = trip.bump,
        has_one = owner,
    )]
    pub trip: Account<'info, Trip>,

    #[account(
        mut,
        associated_token::authority = trip,
        associated_token::mint = trip.mint
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CloseTrip>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trip = &ctx.accounts.trip;

    require!(trip.locked || now > trip.end_ts, RoamSafeError::CloseNotAllowed);
    require!(ctx.accounts.vault.amount == 0, RoamSafeError::VaultNotEmpty);

    let trip_id_bytes = trip.trip_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[
        b"trip",
        trip.owner.as_ref(),
        trip_id_bytes.as_ref(),
        &[trip.bump],
    ];

    let cpi_accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
        authority: ctx.accounts.trip.to_account_info(),
    };
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts,
        &[signer_seeds],
    ))?;

    emit!(TripClosed {
        trip: trip.key(),
        owner: trip.owner,
    });

    Ok(())
}

#[event]
pub struct TripClosed {
    pub trip: Pubkey,
    pub owner: Pubkey,
}
