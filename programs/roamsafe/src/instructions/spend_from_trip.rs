use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::state::Trip;

#[derive(Accounts)]
pub struct SpendFromTrip<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"trip", owner.key().as_ref(), &trip.trip_id.to_le_bytes()],
        bump = trip.bump,
        has_one = owner,
        has_one = mint,
    )]
    pub trip: Account<'info, Trip>,

    pub mint: Account<'info, Mint>,

    /// CHECK: Any wallet can be selected as a merchant. It is only used as ATA authority.
    pub merchant: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = merchant
    )]
    pub merchant_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::authority = trip,
        associated_token::mint = trip.mint
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SpendFromTrip>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trip = &mut ctx.accounts.trip;
    let approval = trip.approve_spend(now, amount, ctx.accounts.vault.amount)?;

    let trip_id_bytes = trip.trip_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[
        b"trip",
        trip.owner.as_ref(),
        trip_id_bytes.as_ref(),
        &[trip.bump],
    ];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.merchant_ata.to_account_info(),
        authority: trip.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            &[signer_seeds],
        ),
        amount,
    )?;

    trip.spent_today = approval.spent_today;
    trip.total_spent = approval.total_spent;
    trip.day_window_start = approval.day_window_start;

    emit!(TravelPaymentApproved {
        trip: trip.key(),
        merchant: ctx.accounts.merchant.key(),
        amount,
        spent_today: trip.spent_today,
        total_spent: trip.total_spent,
    });

    Ok(())
}

#[event]
pub struct TravelPaymentApproved {
    pub trip: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub spent_today: u64,
    pub total_spent: u64,
}
