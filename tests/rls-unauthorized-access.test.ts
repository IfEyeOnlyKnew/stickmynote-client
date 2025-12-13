/**
 * RLS Unauthorized Access Pattern Tests
 * Run with: npx tsx scripts/test-rls-unauthorized-access.ts
 *
 * These tests verify that unauthorized users cannot access protected data
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create clients for different user contexts
const anonClient = createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

interface TestResult {
  test: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

async function runTest(name: string, testFn: () => Promise<boolean>) {
  try {
    const passed = await testFn()
    results.push({ test: name, passed })
    console.log(`${passed ? "✅" : "❌"} ${name}`)
  } catch (error) {
    results.push({
      test: name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
    console.log(`❌ ${name}: ${error}`)
  }
}

async function setupTestData() {
  console.log("\n🔧 Setting up test data...\n")

  // Create two test users
  const { data: user1 } = await serviceClient.auth.admin.createUser({
    email: "test-user-1@example.com",
    password: "test-password-123",
    email_confirm: true,
  })

  const { data: user2 } = await serviceClient.auth.admin.createUser({
    email: "test-user-2@example.com",
    password: "test-password-123",
    email_confirm: true,
  })

  if (!user1?.user || !user2?.user) {
    throw new Error("Failed to create test users")
  }

  // Create test data as user1
  const user1Client = createClient(supabaseUrl, supabaseAnonKey)
  await user1Client.auth.signInWithPassword({
    email: "test-user-1@example.com",
    password: "test-password-123",
  })

  // Create a private note
  const { data: note } = await user1Client
    .from("notes")
    .insert({
      user_id: user1.user.id,
      content: "Private note content",
      topic: "Private Note",
      color: "#yellow",
      position_x: 0,
      position_y: 0,
      is_shared: false,
    })
    .select()
    .single()

  // Create a private social pad
  const { data: pad } = await user1Client
    .from("social_pads")
    .insert({
      owner_id: user1.user.id,
      name: "Private Pad",
      description: "Private pad for testing",
      is_public: false,
    })
    .select()
    .single()

  // Create a stick in the private pad
  const { data: stick } = await user1Client
    .from("social_sticks")
    .insert({
      social_pad_id: pad.id,
      user_id: user1.user.id,
      topic: "Private Stick",
      content: "Private stick content",
      color: "#blue",
      is_public: false,
    })
    .select()
    .single()

  return {
    user1: user1.user,
    user2: user2.user,
    note,
    pad,
    stick,
  }
}

async function runTests() {
  console.log("🔒 RLS Unauthorized Access Pattern Tests\n")

  const testData = await setupTestData()

  // Create client for user2
  const user2Client = createClient(supabaseUrl, supabaseAnonKey)
  await user2Client.auth.signInWithPassword({
    email: "test-user-2@example.com",
    password: "test-password-123",
  })

  // ============================================================================
  // TEST 1: Unauthorized note access
  // ============================================================================

  await runTest("User2 cannot read User1's private notes", async () => {
    const { data, error } = await user2Client.from("notes").select("*").eq("id", testData.note.id).single()

    return data === null && error !== null
  })

  await runTest("User2 cannot update User1's notes", async () => {
    const { error } = await user2Client.from("notes").update({ content: "Hacked content" }).eq("id", testData.note.id)

    return error !== null
  })

  await runTest("User2 cannot delete User1's notes", async () => {
    const { error } = await user2Client.from("notes").delete().eq("id", testData.note.id)

    return error !== null
  })

  // ============================================================================
  // TEST 2: Unauthorized social pad access
  // ============================================================================

  await runTest("User2 cannot read User1's private pad", async () => {
    const { data, error } = await user2Client.from("social_pads").select("*").eq("id", testData.pad.id).single()

    return data === null && error !== null
  })

  await runTest("User2 cannot update User1's pad", async () => {
    const { error } = await user2Client.from("social_pads").update({ name: "Hacked Pad" }).eq("id", testData.pad.id)

    return error !== null
  })

  await runTest("User2 cannot delete User1's pad", async () => {
    const { error } = await user2Client.from("social_pads").delete().eq("id", testData.pad.id)

    return error !== null
  })

  // ============================================================================
  // TEST 3: Unauthorized social stick access
  // ============================================================================

  await runTest("User2 cannot read User1's private stick", async () => {
    const { data, error } = await user2Client.from("social_sticks").select("*").eq("id", testData.stick.id).single()

    return data === null && error !== null
  })

  await runTest("User2 cannot create stick in User1's pad", async () => {
    const { error } = await user2Client.from("social_sticks").insert({
      social_pad_id: testData.pad.id,
      user_id: testData.user2.id,
      topic: "Unauthorized Stick",
      content: "Should not be created",
      color: "#red",
    })

    return error !== null
  })

  await runTest("User2 cannot update User1's stick", async () => {
    const { error } = await user2Client
      .from("social_sticks")
      .update({ content: "Hacked content" })
      .eq("id", testData.stick.id)

    return error !== null
  })

  await runTest("User2 cannot delete User1's stick", async () => {
    const { error } = await user2Client.from("social_sticks").delete().eq("id", testData.stick.id)

    return error !== null
  })

  // ============================================================================
  // TEST 4: Unauthorized member manipulation
  // ============================================================================

  await runTest("User2 cannot add themselves to User1's pad", async () => {
    const { error } = await user2Client.from("social_pad_members").insert({
      social_pad_id: testData.pad.id,
      user_id: testData.user2.id,
      role: "admin",
      admin_level: "admin",
      accepted: true,
    })

    return error !== null
  })

  // ============================================================================
  // TEST 5: Anonymous user restrictions
  // ============================================================================

  await runTest("Anonymous users cannot read private notes", async () => {
    const { data, error } = await anonClient.from("notes").select("*").eq("id", testData.note.id).single()

    return data === null && error !== null
  })

  await runTest("Anonymous users cannot read private pads", async () => {
    const { data, error } = await anonClient.from("social_pads").select("*").eq("id", testData.pad.id).single()

    return data === null && error !== null
  })

  await runTest("Anonymous users cannot create notes", async () => {
    const { error } = await anonClient.from("notes").insert({
      content: "Anonymous note",
      topic: "Test",
      color: "#yellow",
      position_x: 0,
      position_y: 0,
    })

    return error !== null
  })

  // ============================================================================
  // TEST 6: User profile security
  // ============================================================================

  await runTest("User2 cannot update User1's profile", async () => {
    const { error } = await user2Client.from("users").update({ full_name: "Hacked Name" }).eq("id", testData.user1.id)

    return error !== null
  })

  await runTest("User2 cannot change their own user ID", async () => {
    const { error } = await user2Client.from("users").update({ id: testData.user1.id }).eq("id", testData.user2.id)

    return error !== null
  })

  // Print summary
  console.log("\n" + "=".repeat(50))
  console.log("📊 Test Summary")
  console.log("=".repeat(50))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log(`\nTotal Tests: ${results.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)

  if (failed > 0) {
    console.log("\n❌ Failed Tests:")
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.test}`)
        if (r.error) console.log(`    Error: ${r.error}`)
      })
  }

  // Cleanup
  console.log("\n🧹 Cleaning up test data...")
  await serviceClient.auth.admin.deleteUser(testData.user1.id)
  await serviceClient.auth.admin.deleteUser(testData.user2.id)

  console.log("\n✨ Tests complete!\n")

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(console.error)
