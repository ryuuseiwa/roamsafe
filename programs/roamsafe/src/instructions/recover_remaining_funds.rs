use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{error::RoamSafeError, state::Trip};

#[derive(Accounts)]
pub struct RecoverRemainingFunds<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Must equal trip.owner; used as the destination ATA authority.
    #[account(address = trip.owner)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut, has_one = mint)]
    pub trip: Account<'info, Trip>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::authority = trip,
        associated_token::mint = trip.mint
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub owner_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RecoverRemainingFunds>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trip = &ctx.accounts.trip;

    require!(
        trip.is_authorized_recovery(ctx.accounts.authority.key()),
        RoamSafeError::UnauthorizedRecoveryAuthority
    );
    require!(trip.locked || now > trip.end_ts, RoamSafeError::RecoveryNotAllowed);

    let amount = ctx.accounts.vault.amount;
    if amount == 0 {
        return Ok(());
    }

    let trip_id_bytes = trip.trip_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[
        b"trip",
        trip.owner.as_ref(),
        trip_id_bytes.as_ref(),
        &[trip.bump],
    ];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.owner_ata.to_account_info(),
        authority: ctx.accounts.trip.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            &[signer_seeds],
        ),
        amount,
    )?;

    emit!(TripFundsRecovered {
        trip: trip.key(),
        owner: trip.owner,
        amount,
    });

    Ok(())
}

#[event]
pub struct TripFundsRecovered {
    pub trip: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}
