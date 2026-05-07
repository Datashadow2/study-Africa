import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// =========================
// SUPABASE SETUP
// =========================
const supabaseUrl = "https://umpfhkvdkaufhtmmgxxg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGZoa3Zka2F1Zmh0bW1neHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjk4MzMsImV4cCI6MjA5MzY0NTgzM30.zAiHoJLm9w9cmE6iHaLI9quvQw1zZOgV800yHZIIMwo";

const supabase = createClient(supabaseUrl, supabaseKey);

// =========================
// AUTH FUNCTION
// =========================
window.handleAuth = async function handleAuth() {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const status = document.getElementById("status");

  if (!email || !password) {
    status.innerText = "Please fill in all fields.";
    return;
  }

  status.innerText = "Creating account...";

  try {

    // =========================
    // SIGN UP USER
    // =========================
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      status.innerText = error.message;
      return;
    }

    const user = data.user;

    if (!user) {
      status.innerText = "Signup failed. Try again.";
      return;
    }

    status.innerText = "Saving profile...";

    // =========================
    // SAVE USER ROLE IN DB
    // =========================
    const { error: dbError } = await supabase
      .from("users")
      .insert([
        {
          id: user.id,
          email: email,
          role: role
        }
      ]);

    if (dbError) {
      status.innerText = dbError.message;
      return;
    }

    status.innerText = "Success! Redirecting...";

    // =========================
    // ROUTE USER
    // =========================
    setTimeout(() => {

      if (role === "student") {
        window.location.href = "student-dashboard.html";
      } else {
        window.location.href = "teacher-dashboard.html";
      }

    }, 1000);

  } catch (err) {
    status.innerText = "Unexpected error: " + err.message;
  }
};

// =========================
// OPTIONAL: AUTO SESSION CHECK
// =========================
window.addEventListener("load", async () => {

  const { data } = await supabase.auth.getUser();

  if (data?.user) {
    console.log("User already logged in:", data.user.email);
  }

});
