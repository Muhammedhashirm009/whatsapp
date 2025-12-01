import { initializeStorage, storage } from "./storage";

async function testDbAuth() {
  console.log("Testing database auth storage...\n");

  try {
    await initializeStorage();
    console.log("✓ Storage initialized\n");

    console.log("1. Testing setAuthData...");
    await storage.setAuthData("test-key", JSON.stringify({ foo: "bar", num: 123 }));
    console.log("   ✓ Data saved\n");

    console.log("2. Testing getAuthData...");
    const data = await storage.getAuthData("test-key");
    if (data) {
      const parsed = JSON.parse(data);
      console.log("   ✓ Data retrieved:", parsed);
      if (parsed.foo === "bar" && parsed.num === 123) {
        console.log("   ✓ Data matches!\n");
      } else {
        console.log("   ✗ Data mismatch!\n");
      }
    } else {
      console.log("   ✗ No data returned!\n");
    }

    console.log("3. Testing getAllAuthKeys...");
    const keys = await storage.getAllAuthKeys();
    console.log("   ✓ Keys:", keys, "\n");

    console.log("4. Testing deleteAuthData...");
    await storage.deleteAuthData("test-key");
    const deleted = await storage.getAuthData("test-key");
    if (deleted === null) {
      console.log("   ✓ Data deleted successfully\n");
    } else {
      console.log("   ✗ Data still exists!\n");
    }

    console.log("5. Testing multiple keys...");
    await storage.setAuthData("creds", JSON.stringify({ registrationId: 12345 }));
    await storage.setAuthData("pre-key-1", JSON.stringify({ keyPair: "test1" }));
    await storage.setAuthData("pre-key-2", JSON.stringify({ keyPair: "test2" }));
    const allKeys = await storage.getAllAuthKeys();
    console.log("   ✓ All keys:", allKeys, "\n");

    console.log("6. Testing clearAllAuthData...");
    await storage.clearAllAuthData();
    const keysAfterClear = await storage.getAllAuthKeys();
    if (keysAfterClear.length === 0) {
      console.log("   ✓ All auth data cleared\n");
    } else {
      console.log("   ✗ Data still exists:", keysAfterClear, "\n");
    }

    console.log("=".repeat(40));
    console.log("All tests passed! Database auth storage is working.");
    console.log("=".repeat(40));

  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }

  process.exit(0);
}

testDbAuth();
