SELECT conname FROM pg_constraint WHERE conrelid = '"FundingFee"'::regclass AND contype = 'u';
