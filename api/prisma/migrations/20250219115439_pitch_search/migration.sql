ALTER TABLE "Pitch" 
ADD COLUMN search tsvector GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;

CREATE INDEX search_idx ON "Pitch" USING GIN (search);

-- RenameIndex
ALTER INDEX "location_idx" RENAME TO "coordinates_idx";
