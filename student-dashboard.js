import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let isPremium = false;
let trialEndDate = null;
let currentUser = null;

// =========================
// HELPER FUNCTIONS
// =========================
function showError(msg) {
  alert(msg);
}

function setLoading(elementId, state, originalText) {
  const btn = document.getElementById(elementId);
  if (!btn) return;
  if (state) {
    btn.dataset.originalText = btn.innerText;
    btn.innerText = "Loading...";
    btn.disabled = true;
  } else {
    btn.innerText = btn.dataset.originalText || originalText;
    btn.disabled = false;
  }
}

// =========================
// AUTH CHECK
// =========================
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = "auth.html";
    return null;
  }
  
  currentUser = session.user;
  return session;
}

// =========================
// LOAD USER PROFILE
// =========================
async function loadUserProfile() {
  if (!currentUser) return;
  
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();
  
  if (error) {
    console.error("Error loading profile:", error);
    return;
  }
  
  if (profile) {
    // Set premium status
    isPremium = profile.is_premium || false;
    trialEndDate = profile.trial_end_date ? new Date(profile.trial_end_date) : null;
    
    // Update UI with user name
    const studentNameEl = document.getElementById("studentName");
    if (studentNameEl) {
      const name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || "Student";
      studentNameEl.innerText = name;
    }
    
    // Update streak
    const streak = profile.streak || 0;
    const streakEl = document.getElementById("streak");
    if (streakEl) streakEl.innerText = streak;
    
    // Update premium UI
    updatePremiumUI();
    
    // Update trial countdown
    if (!isPremium) {
      updateTrialCountdown();
      setInterval(updateTrialCountdown, 1000);
    }
  }
}

// =========================
// UPDATE PREMIUM UI
// =========================
function updatePremiumUI() {
  const premiumStatusEl = document.getElementById("premiumStatus");
  const premiumBadge = document.getElementById("premiumBadge");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const trialCountdown = document.getElementById("trialCountdown");
  
  if (isPremium) {
    if (premiumStatusEl) {
      premiumStatusEl.innerHTML = "✅ <strong class='status-premium'>Active Premium Member</strong> - Unlimited access to all resources!";
    }
    if (premiumBadge) {
      premiumBadge.innerHTML = "<span class='premium-badge'>⭐ PREMIUM</span>";
    }
    if (upgradeBtn) {
      upgradeBtn.innerText = "🎉 Premium Active";
      upgradeBtn.disabled = true;
    }
    if (trialCountdown) {
      trialCountdown.style.display = "none";
    }
  } else {
    if (premiumStatusEl) {
      premiumStatusEl.innerHTML = "⚠️ <strong class='status-free'>Free Account</strong> - Upgrade to unlock premium content!";
    }
    if (premiumBadge) {
      premiumBadge.innerHTML = "";
    }
    if (upgradeBtn) {
      upgradeBtn.innerText = "💎 Upgrade to Premium (200 KES/month)";
      upgradeBtn.disabled = false;
    }
    if (trialCountdown) {
      trialCountdown.style.display = "block";
    }
  }
}

// =========================
// UPDATE TRIAL COUNTDOWN
// =========================
function updateTrialCountdown() {
  if (!trialEndDate || isPremium) return;
  
  const now = new Date();
  const diff = trialEndDate - now;
  
  const trialMessage = document.getElementById("trialMessage");
  const daysRemainingEl = document.getElementById("daysRemaining");
  const trialProgress = document.getElementById("trialProgress");
  const featuresGrid = document.getElementById("featuresGrid");
  
  if (diff <= 0) {
    // Trial expired
    if (trialMessage) {
      trialMessage.innerHTML = "⚠️ <strong>Your free trial has ended!</strong> Please upgrade to continue access.";
    }
    if (daysRemainingEl) {
      daysRemainingEl.innerHTML = "Trial Expired";
    }
    if (trialProgress) {
      trialProgress.value = 100;
    }
    
    // Disable premium features
    if (featuresGrid && !isPremium) {
      featuresGrid.classList.add("disabled-feature");
    }
    
    // Show upgrade banner
    const upgradeBtn = document.getElementById("upgradeBtn");
    if (upgradeBtn) {
      upgradeBtn.style.animation = "pulse 1s infinite";
    }
  } else {
    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const totalDays = 30;
    const progress = ((totalDays - daysLeft) / totalDays) * 100;
    
    if (trialMessage) {
      trialMessage.innerHTML = "🎁 Your free trial ends in:";
    }
    if (daysRemainingEl) {
      daysRemainingEl.innerHTML = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;
    }
    if (trialProgress) {
      trialProgress.value = progress;
    }
  }
}

// =========================
// LOGOUT
// =========================
window.handleLogout = async function() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showError("Error logging out: " + error.message);
  } else {
    window.location.href = "auth.html";
  }
};

// =========================
// UPGRADE TO PREMIUM
// =========================
window.upgradeToPremium = async function() {
  if (isPremium) {
    showError("You are already a premium member!");
    return;
  }
  
  showError("💎 Premium upgrade coming soon! M-Pesa integration will be available shortly.");
  
  // Future implementation:
  // - M-Pesa STK Push
  // - Payment confirmation
  // - Update profiles table set is_premium = true
  // - Reset trial period
};

// =========================
// FEATURE NAVIGATION
// =========================
window.openGames = function() {
  if (!isPremium && trialEndDate && new Date() > trialEndDate) {
    showError("🔒 Games Hub is a premium feature. Please upgrade to continue learning!");
    return;
  }
  showError("🎮 Games Hub coming soon! Play flashcards and quizzes.");
};

window.openPomodoro = function() {
  if (!isPremium && trialEndDate && new Date() > trialEndDate) {
    showError("🔒 Pomodoro Timer is a premium feature. Please upgrade to continue!");
    return;
  }
  showError("⏱️ Pomodoro Timer coming soon! Stay focused.");
};

window.openClubs = function() {
  showError("💬 Clubs feature coming soon! Join study groups.");
};

window.openResources = function() {
  if (!isPremium && trialEndDate && new Date() > trialEndDate) {
    showError("🔒 Learning Resources is a premium feature. Please upgrade to access!");
    return;
  }
  showError("📚 Learning Resources coming soon!");
};

window.openAI = function() {
  if (!isPremium && trialEndDate && new Date() > trialEndDate) {
    showError("🔒 AI Study Assistant is a premium feature. Please upgrade!");
    return;
  }
  showError("🤖 AI Study Assistant coming soon!");
};

window.openLeaderboard = function() {
  showError("🏆 Leaderboard coming soon!");
};

// =========================
// CHECK PREMIUM STATUS FOR FEATURES
// =========================
function checkFeatureAccess() {
  if (!isPremium && trialEndDate && new Date() > trialEndDate) {
    const featuresGrid = document.getElementById("featuresGrid");
    if (featuresGrid) {
      featuresGrid.classList.add("disabled-feature");
    }
  }
}

// =========================
// INITIALIZE DASHBOARD
// =========================
async function init() {
  const session = await checkAuth();
  if (session) {
    await loadUserProfile();
    checkFeatureAccess();
  }
}

// Start the dashboard
init();
