/**
 * @fileoverview Auth & User Portal Controller for Quemeds
 *
 * Implements role-based access presentation for Hospital/Clinician vs Patient
 * personas with 1-click Smart India Hackathon demo profiles.
 */

const STORAGE_KEY_USER = 'quemeds_active_user';

export const DEMO_PROFILES = {
  hospital: {
    name: 'Dr. Manthan',
    role: 'AIIMS Cardiology',
    email: 'm.mehta@aiims.edu',
    avatar: 'M',
    roleType: 'hospital',
    pillText: 'Hospital Account • ABDM Linked',
  },
  patient: {
    name: 'Rahul Sharma',
    role: 'Patient #QM-4821',
    email: 'rahul.s@healthid.abdm',
    avatar: 'RS',
    roleType: 'patient',
    pillText: 'Verified Patient • ABHA Active',
  },
  guest: {
    name: 'Guest Evaluator',
    role: 'SIH 2026 Jury',
    email: 'jury@sih2026.gov.in',
    avatar: 'G',
    roleType: 'hospital',
    pillText: 'Jury Session • Full Access',
  },
};

let currentProfile = DEMO_PROFILES.hospital;
let activeRole = 'hospital';
let activeAction = 'signin';

/**
 * Show temporary toast notification
 * @param {string} msg
 */
export function showAuthToast(msg) {
  let toast = document.getElementById('auth-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'auth-toast';
    toast.className = 'auth-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${msg}</span>
  `;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

/**
 * Open the Auth Portal modal
 * @param {'hospital'|'patient'} [role]
 * @param {'signin'|'signup'} [action]
 */
export function openAuthModal(role = 'hospital', action = 'signin') {
  closeProfileDropdown();
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (backdrop) {
    backdrop.classList.add('open');
    switchAuthRole(role);
    switchAuthAction(action);
  }
}

/**
 * Close Auth Portal modal
 */
export function closeAuthModal() {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

/**
 * Switch persona between 'hospital' and 'patient'
 * @param {'hospital'|'patient'} role
 */
export function switchAuthRole(role) {
  activeRole = role;

  const tabHospital = document.getElementById('role-tab-hospital');
  const tabPatient = document.getElementById('role-tab-patient');

  if (tabHospital && tabPatient) {
    if (role === 'hospital') {
      tabHospital.classList.add('active');
      tabPatient.classList.remove('active');
    } else {
      tabPatient.classList.add('active');
      tabHospital.classList.remove('active');
    }
  }

  updateActiveForm();
}

/**
 * Switch action between 'signin' and 'signup'
 * @param {'signin'|'signup'} action
 */
export function switchAuthAction(action) {
  activeAction = action;

  const tabSignin = document.getElementById('tab-action-signin');
  const tabSignup = document.getElementById('tab-action-signup');

  if (tabSignin && tabSignup) {
    if (action === 'signin') {
      tabSignin.classList.add('active');
      tabSignup.classList.remove('active');
    } else {
      tabSignup.classList.add('active');
      tabSignin.classList.remove('active');
    }
  }

  updateActiveForm();
}

/**
 * Render the appropriate form according to activeRole and activeAction
 */
function updateActiveForm() {
  const formId = `form-${activeRole}-${activeAction}`;
  document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
  const target = document.getElementById(formId);
  if (target) target.classList.add('active');
}

/**
 * Update topbar profile elements and store preference
 * @param {object} profile
 */
export function setProfile(profile) {
  currentProfile = profile;

  const topAvatar = document.getElementById('topbar-avatar');
  const topName = document.getElementById('topbar-user-name');
  const topBadge = document.getElementById('topbar-role-badge');

  const dropAvatar = document.getElementById('dropdown-avatar');
  const dropName = document.getElementById('dropdown-name');
  const dropEmail = document.getElementById('dropdown-email');
  const dropPill = document.getElementById('dropdown-role-pill');
  const switchRoleText = document.getElementById('switch-role-text');

  if (topAvatar) {
    topAvatar.textContent = profile.avatar;
    topAvatar.className = `user-avatar ${profile.roleType}`;
  }
  if (topName) topName.textContent = profile.name;
  if (topBadge) {
    topBadge.textContent = profile.role;
    topBadge.className = `user-role-badge ${profile.roleType}`;
  }

  if (dropAvatar) {
    dropAvatar.textContent = profile.avatar;
    dropAvatar.className = `profile-dropdown-avatar ${profile.roleType}`;
  }
  if (dropName) dropName.textContent = profile.name;
  if (dropEmail) dropEmail.textContent = profile.email;
  if (dropPill) {
    dropPill.textContent = profile.pillText;
    dropPill.className = `profile-pill ${profile.roleType}`;
  }
  if (switchRoleText) {
    switchRoleText.textContent =
      profile.roleType === 'hospital' ? 'Switch to Patient Portal' : 'Switch to Clinician Portal';
  }

  try {
    localStorage.setItem(STORAGE_KEY_USER, profile.roleType);
  } catch { }
}

/**
 * Toggle profile dropdown menu
 */
export function toggleProfileDropdown() {
  const widget = document.getElementById('user-profile-widget');
  if (widget) widget.classList.toggle('active');
}

/**
 * Close profile dropdown menu
 */
export function closeProfileDropdown() {
  const widget = document.getElementById('user-profile-widget');
  if (widget) widget.classList.remove('active');
}

/**
 * Initialise Auth UI listeners
 */
export function initAuth() {
  // Load saved persona if any
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved && DEMO_PROFILES[saved]) {
      setProfile(DEMO_PROFILES[saved]);
    } else {
      setProfile(DEMO_PROFILES.hospital);
    }
  } catch {
    setProfile(DEMO_PROFILES.hospital);
  }

  // Profile widget click
  const profileBtn = document.getElementById('user-profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const widget = document.getElementById('user-profile-widget');
    if (widget && !widget.contains(e.target)) {
      closeProfileDropdown();
    }
  });

  // Switch role button in dropdown
  const switchRoleBtn = document.getElementById('switch-role-btn');
  if (switchRoleBtn) {
    switchRoleBtn.addEventListener('click', () => {
      const nextRole = currentProfile.roleType === 'hospital' ? 'patient' : 'hospital';
      setProfile(DEMO_PROFILES[nextRole]);
      closeProfileDropdown();
      showAuthToast(`Switched active persona to ${DEMO_PROFILES[nextRole].name} (${DEMO_PROFILES[nextRole].role})`);
    });
  }

  // Open Auth Portal button in dropdown
  const openAuthBtn = document.getElementById('open-auth-btn');
  if (openAuthBtn) {
    openAuthBtn.addEventListener('click', () => {
      openAuthModal('hospital', 'signin');
    });
  }

  // Sign out / reset session
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      setProfile(DEMO_PROFILES.guest);
      closeProfileDropdown();
      showAuthToast('Session reset to Guest Evaluator mode');
    });
  }

  // Modal close button
  const closeBtn = document.getElementById('auth-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAuthModal);
  }

  // Modal backdrop click
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAuthModal();
    });
  }

  // Role selector tabs
  const tabHospital = document.getElementById('role-tab-hospital');
  const tabPatient = document.getElementById('role-tab-patient');
  if (tabHospital) tabHospital.addEventListener('click', () => switchAuthRole('hospital'));
  if (tabPatient) tabPatient.addEventListener('click', () => switchAuthRole('patient'));

  // Action tabs (Sign In vs Sign Up)
  const tabSignin = document.getElementById('tab-action-signin');
  const tabSignup = document.getElementById('tab-action-signup');
  if (tabSignin) tabSignin.addEventListener('click', () => switchAuthAction('signin'));
  if (tabSignup) tabSignup.addEventListener('click', () => switchAuthAction('signup'));

  // SIH 1-Click Demo Buttons
  const demoHospitalBtn = document.getElementById('demo-hospital-btn');
  if (demoHospitalBtn) {
    demoHospitalBtn.addEventListener('click', () => {
      setProfile(DEMO_PROFILES.hospital);
      closeAuthModal();
      showAuthToast('Authenticated as Dr. Manthan (AIIMS Delhi • Cardiology)');
    });
  }

  const demoPatientBtn = document.getElementById('demo-patient-btn');
  if (demoPatientBtn) {
    demoPatientBtn.addEventListener('click', () => {
      setProfile(DEMO_PROFILES.patient);
      closeAuthModal();
      showAuthToast('Authenticated as Rahul Sharma (Patient ID #QM-4821)');
    });
  }

  // Form submission simulations
  const forms = [
    { id: 'form-hospital-signin', profile: DEMO_PROFILES.hospital, actionText: 'Hospital Portal Signed In' },
    { id: 'form-hospital-signup', profile: DEMO_PROFILES.hospital, actionText: 'New Hospital Account Registered' },
    { id: 'form-patient-signin', profile: DEMO_PROFILES.patient, actionText: 'Patient Portal Signed In' },
    { id: 'form-patient-signup', profile: DEMO_PROFILES.patient, actionText: 'New Patient ABHA Account Created' },
  ];

  forms.forEach(({ id, profile, actionText }) => {
    const f = document.getElementById(id);
    if (f) {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        setProfile(profile);
        closeAuthModal();
        showAuthToast(`${actionText} — Welcome, ${profile.name}!`);
      });
    }
  });

  // Global window access for inline onclick triggers
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
}
