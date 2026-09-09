ALTER TABLE "WorkDiarySignToken"
ADD COLUMN "tokenCiphertext" TEXT;

ALTER TABLE "OpsDeliveryNoteSignToken"
ADD COLUMN "tokenCiphertext" TEXT;

ALTER TABLE "MeasurementSheetSignToken"
ADD COLUMN "tokenCiphertext" TEXT;

ALTER TABLE "ExternalShareLink"
ADD COLUMN "tokenCiphertext" TEXT;
