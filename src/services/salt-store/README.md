# Salt Store Configuration

The salt store can be configured using environment variables to choose between different storage backends.

## Environment Variables

### SALT_STORE_TYPE
Determines which salt store implementation to use.

**Options:**
- `memory` (default) - In-memory storage, data is lost on restart
- `file` - (not implemented yet) - File-based storage, persists data to disk 

**Example:**
```bash
SALT_STORE_TYPE=file
```

### SALT_STORE_FILE_PATH
When using `SALT_STORE_TYPE=file`, this specifies the file path for storing salts.

**Default:** `salts.json` in the current working directory

**Example:**
```bash
SALT_STORE_FILE_PATH=/app/data/salts.json
```

## Adding New Salt Store Types

To add new salt store implementations (like Redis or Firestore):

1. Create a new class implementing `ISaltStore`
2. Add the new type to `SaltStoreType` in `SaltStoreFactory.ts`
3. Add a case for the new type in the `createSaltStore` function
4. Update this documentation 
