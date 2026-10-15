use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{error::RoamSafeError, state::Trip};

#[derive(Accounts)]
pub struct FundTrip<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"trip", owner.key().as_ref(), &trip.trip_id.to_le_bytes()],
        bump = trip.bump,
        has_one = owner,
    )]
    pub trip: Account<'info, Trip>,

    #[account(
        mut,
        constraint = owner_ata.owner == owner.key(),
        constraint = owner_ata.mint == trip.mint
    )]
    pub owner_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = trip,
        associated_token::mint = trip.mint
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FundTrip>, amount: u64) -> Result<()> {
    require!(amount > 0, RoamSafeError::InvalidAmount);

    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_ata.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
        amount,
    )?;

    emit!(TripFunded {
        trip: ctx.accounts.trip.key(),
        owner: ctx.accounts.owner.key(),
        amount,
    });

    Ok(())
}

#[event]
pub struct TripFunded {
    pub trip: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}
