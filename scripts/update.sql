DROP TRIGGER IF EXISTS location_trigger ON "Pitch";

CREATE TRIGGER location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON "Pitch"
FOR EACH ROW EXECUTE FUNCTION add_location();