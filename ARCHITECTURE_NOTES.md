# RoamSafe architecture notes

## PDA

```text
Trip PDA = find_program_address([
  "trip",
  owner_pubkey,
  trip_id_as_8_little_endian_bytes
])
```

The Trip PDA stores policy. It is also the authority of the trip vault ATA.

## Core state

- owner
- recovery_authority
- mint
- trip_id
- start_ts / end_ts
- daily_limit
- max_tx_amount
- emergency_reserve
- spent_today
- total_spent
- day_window_start
- locked
- bump

## Invariants

- `end_ts > start_ts`
- ordinary spending only when `start_ts <= Clock.unix_timestamp <= end_ts`
- ordinary spending impossible when `locked == true`
- `amount <= max_tx_amount`
- `spent_today + amount <= daily_limit`
- `vault.amount - amount >= emergency_reserve`
- only the Trip PDA signs vault outflows
- recovery always goes to the recorded owner
- trip cannot close until vault token balance is zero
