export const ACCOUNT_ISSUANCE_CONTINUITY_SQL = `
ALTER TABLE account.accounts ADD COLUMN latest_issued_epoch integer
  CHECK (latest_issued_epoch >= 0);
ALTER TABLE account.accounts ADD COLUMN latest_issued_request_hash text
  CHECK (latest_issued_request_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE account.deleted_subjects ADD COLUMN latest_issued_epoch integer
  CHECK (latest_issued_epoch >= 0);
UPDATE account.accounts AS a SET latest_issued_epoch = i.epoch
FROM (SELECT account_id, MAX(epoch) AS epoch FROM account.credential_issuance GROUP BY account_id) AS i
WHERE a.account_id = i.account_id;
-- Already-deleted issuance history is irrecoverable. Do not invent a clean history.
-- Its prior limitation is a release migration decision, not proof of revocation enforcement.
`;
