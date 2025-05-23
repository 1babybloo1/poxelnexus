// Firebase Config (Same as before, ensure it's correct)
const firebaseConfig = {
  apiKey: "AIzaSyDZV415UEPQsqH9AlbPliuhJ9rpOq_6xqA", // Replace with your actual API key
  authDomain: "poxel-699c6.firebaseapp.com",
  projectId: "poxel-699c6",
  storageBucket: "poxel-699c6.firebasestorage.app",
  messagingSenderId: "845941808807",
  appId: "1:845941808807:web:5c319a1153ff499acc0582",
  measurementId: "G-HCQMGPP6WP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutButton = document.getElementById('logout-button');
const authSection = document.getElementById('auth-section');
const userContentSection = document.getElementById('user-content');
const welcomeMessage = document.getElementById('welcome-message');

const cratesGrid = document.getElementById('crates-grid');
const cratesGridLoader = document.getElementById('crates-grid-loader');
const ownedItemsList = document.getElementById('owned-items-list');
const ownedItemsLoader = document.getElementById('owned-items-loader');

const toastContainer = document.getElementById('toast-container');
const itemRevealModal = document.getElementById('item-reveal-modal');
const unboxedItemDisplay = document.getElementById('unboxed-item-display');
const closeModalButton = document.getElementById('close-modal-button');

// New DOM Elements for Item Request
const openItemRequestModalButton = document.getElementById('open-item-request-modal-button');
const itemRequestModal = document.getElementById('item-request-modal');
const closeRequestModalButton = document.getElementById('close-request-modal-button');
const poxelUsernameInput = document.getElementById('poxel-username-input');
const requestableItemsList = document.getElementById('requestable-items-list');
const requestableItemsLoader = document.getElementById('requestable-items-loader');
const submitItemRequestButton = document.getElementById('submit-item-request-button');

document.getElementById('current-year').textContent = new Date().getFullYear();

// Global state for item request
let currentUserItemGroups = new Map(); // Stores { itemId: { details: item, count: number } }
let selectedItemsForRequest = new Map(); // Stores { itemId: { details: item, count: number } }

// --- Utility Functions ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'error') iconClass = 'fas fa-exclamation-circle';

    toast.innerHTML = `<i class="${iconClass}"></i> ${message}`;
    toastContainer.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.remove(); }, 500);
    }, 4000);
}

function toggleButtonLoading(button, isLoading, originalHTML = null) {
    if (isLoading) {
        button.disabled = true;
        if (button.dataset.originalHTML === undefined) {
           button.dataset.originalHTML = button.innerHTML;
        }
        button.innerHTML = `<span class="loader-btn-spinner"></span> Loading...`;
        const spinnerStyleId = 'btnSpinnerStyle';
        if (!document.getElementById(spinnerStyleId)) {
            const spinnerStyle = document.createElement('style');
            spinnerStyle.id = spinnerStyleId;
            spinnerStyle.innerHTML = `
                .loader-btn-spinner {
                    width: 1em; height: 1em;
                    border: 2px solid currentColor;
                    border-right-color: transparent;
                    border-radius: 50%;
                    display: inline-block;
                    animation: spin 0.6s linear infinite;
                    margin-right: 5px; vertical-align: text-bottom;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `;
            document.head.appendChild(spinnerStyle);
        }
    } else {
        button.disabled = false;
        if (button.dataset.originalHTML !== undefined) {
            button.innerHTML = button.dataset.originalHTML;
            delete button.dataset.originalHTML;
        } else if (originalHTML) {
            button.innerHTML = originalHTML;
        } else {
            button.innerHTML = button.textContent || "Submit";
        }
    }
}


// --- Auth State Listener ---
auth.onAuthStateChanged(async user => {
    if (user) {
        authSection.style.display = 'none';
        userContentSection.style.display = 'block';
        logoutButton.style.display = 'inline-flex';
        welcomeMessage.textContent = `Welcome back, ${user.email.split('@')[0]}!`;
        await displayCrates();
        setupOwnedItemsListener(user.uid);
        if (openItemRequestModalButton) {
            openItemRequestModalButton.style.display = 'inline-flex';
            openItemRequestModalButton.disabled = true; // Disable until items load
        }
    } else {
        authSection.style.display = 'block';
        userContentSection.style.display = 'none';
        logoutButton.style.display = 'none';
        welcomeMessage.textContent = '';
        cratesGrid.innerHTML = '';
        ownedItemsList.innerHTML = '';
        if (window.itemsUnsubscribe) {
            window.itemsUnsubscribe();
            window.itemsUnsubscribe = null;
        }
        currentUserItemGroups.clear();
        selectedItemsForRequest.clear();
        if (openItemRequestModalButton) openItemRequestModalButton.style.display = 'none';

        // Close modals if open
        if (itemRevealModal.classList.contains('show')) {
            itemRevealModal.classList.remove('show');
            setTimeout(() => { itemRevealModal.style.display = 'none'; }, 300);
        }
        if (itemRequestModal && itemRequestModal.classList.contains('show')) {
             itemRequestModal.classList.remove('show');
             setTimeout(() => { itemRequestModal.style.display = 'none'; }, 300);
        }
    }
});

// --- Auth Functions ---
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const loginButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonHTML = loginButton.innerHTML;
        toggleButtonLoading(loginButton, true, originalButtonHTML);

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                showToast("Login successful! Welcome back.", 'success');
                loginForm.reset();
            })
            .catch((error) => {
                showToast(`Login failed: ${error.message}`, 'error');
            })
            .finally(() => toggleButtonLoading(loginButton, false, originalButtonHTML));
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const signupButton = signupForm.querySelector('button[type="submit"]');
        const originalButtonHTML = signupButton.innerHTML;
        toggleButtonLoading(signupButton, true, originalButtonHTML);

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                showToast("Signup successful! Welcome aboard!", 'success');
                return db.collection("users").doc(userCredential.user.uid).set({
                    email: userCredential.user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    ownedItems: []
                });
            })
            .then(() => {
                signupForm.reset();
            })
            .catch((error) => {
                showToast(`Signup failed: ${error.message}`, 'error');
            })
            .finally(() => toggleButtonLoading(signupButton, false, originalButtonHTML));
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        const originalButtonHTML = logoutButton.innerHTML;
        toggleButtonLoading(logoutButton, true, originalButtonHTML);
        auth.signOut()
            .then(() => showToast("You have been logged out.", 'info'))
            .catch((error) => showToast(`Logout error: ${error.message}`, 'error'))
            .finally(() => toggleButtonLoading(logoutButton, false, originalButtonHTML));
    });
}


// --- Item Randomizer/Unboxing ---
async function displayCrates() {
    if (!cratesGrid) return;
    cratesGrid.innerHTML = '';
    if (cratesGridLoader) cratesGridLoader.style.display = 'block';
    try {
        const cratesSnapshot = await db.collection("crates").get();
        if (cratesGridLoader) cratesGridLoader.style.display = 'none';
        if (cratesSnapshot.empty) {
            cratesGrid.innerHTML = "<p style='text-align:center; width:100%;'>No crates available currently. Check back later!</p>";
            return;
        }
        cratesSnapshot.forEach(doc => {
            const crate = doc.data();
            const crateId = doc.id;
            const crateDiv = document.createElement("div");
            crateDiv.classList.add("crate-option");
            crateDiv.innerHTML = `
                <img src="${crate.imageUrl || 'https://via.placeholder.com/100x100?text=Crate'}" alt="${crate.name}" class="crate-image">
                <h4>${crate.name || 'Mystery Crate'}</h4>
                <p>${crate.description || 'Contains exciting items!'}</p>
                <button class="button-style primary-button small-button"><i class="fas fa-box"></i> Open</button>
            `;
            const openButton = crateDiv.querySelector('button');
            if (openButton) {
                openButton.onclick = (e) => {
                    e.stopPropagation();
                    handleOpenCrate(crateId, crate.name, openButton);
                };
            }
            cratesGrid.appendChild(crateDiv);
        });
    } catch (error) {
        if (cratesGridLoader) cratesGridLoader.style.display = 'none';
        cratesGrid.innerHTML = "<p style='text-align:center; width:100%;'>Error loading crates. Please try refreshing.</p>";
        showToast(`Error loading crates: ${error.message}`, 'error');
    }
}

async function handleOpenCrate(crateId, crateName, openButtonElement) {
    const user = auth.currentUser;
    if (!user) {
        showToast("Please log in to open a crate.", 'error');
        return;
    }

    if (!confirm(`Open the "${crateName || crateId}" crate? This action is irreversible.`)) {
        return;
    }

    const originalButtonHTML = openButtonElement.innerHTML;
    toggleButtonLoading(openButtonElement, true, originalButtonHTML);

    try {
        const crateDocRef = db.collection("crates").doc(crateId);
        const crateDoc = await crateDocRef.get();

        if (!crateDoc.exists) {
            throw new Error("Crate not found. It might have been removed.");
        }

        const crateData = crateDoc.data();
        const items = crateData.items;

        if (!Array.isArray(items)) {
            throw new Error("Crate data is corrupted or 'items' field is missing/not an array.");
        }
        if (items.length === 0) {
            throw new Error("This crate is empty and has no items to unbox.");
        }

        const totalWeight = items.reduce((sum, item) => {
            const weight = (typeof item.weight === 'number' && !isNaN(item.weight)) ? item.weight : 1;
            return sum + (weight > 0 ? weight : 1);
        }, 0);

        if (totalWeight <= 0) {
             throw new Error("Crate items have invalid weights, cannot select an item.");
        }

        let randomNum = Math.random() * totalWeight;
        let selectedItem = null;

        for (const item of items) {
            const currentItemWeight = (typeof item.weight === 'number' && !isNaN(item.weight) && item.weight > 0) ? item.weight : 1;
            randomNum -= currentItemWeight;
            if (randomNum <= 0) {
                selectedItem = { ...item };
                break;
            }
        }

        if (!selectedItem) {
            selectedItem = { ...items[items.length - 1] };
        }

        const unboxedItemData = {
            itemId: selectedItem.itemId || `unknown_item_${Date.now()}`,
            name: selectedItem.name || "Unknown Item",
            rarity: selectedItem.rarity || "Common",
            imageUrl: selectedItem.imageUrl !== undefined ? selectedItem.imageUrl : null,
            description: selectedItem.description !== undefined ? selectedItem.description : null,
            acquiredAt: firebase.firestore.Timestamp.now(),
            openedCrateId: crateId,
            openedCrateName: crateName || crateData.name || 'Unknown Crate'
        };

        await db.collection("users").doc(user.uid).update({
            ownedItems: firebase.firestore.FieldValue.arrayUnion(unboxedItemData)
        });

        unboxedItemDisplay.innerHTML = `
            <img src="${unboxedItemData.imageUrl || 'https://via.placeholder.com/150x150?text=Item'}" alt="${unboxedItemData.name}" class="item-image">
            <h3>${unboxedItemData.name || 'Mysterious Item'}</h3>
            <p class="item-rarity ${unboxedItemData.rarity ? unboxedItemData.rarity.toLowerCase().replace(/\s+/g, '-') : ''}">${unboxedItemData.rarity || 'Unknown Rarity'}</p>
            <p>${unboxedItemData.description || 'A newly discovered item!'}</p>
        `;
        itemRevealModal.style.display = 'flex';
        itemRevealModal.classList.add('show');

    } catch (error) {
        console.error("Error in handleOpenCrate for crateId: " + crateId, error);
        showToast(`Failed to open crate: ${error.message}`, 'error');
    } finally {
        if (openButtonElement.disabled) {
            toggleButtonLoading(openButtonElement, false, originalButtonHTML);
        }
    }
}

if (closeModalButton) {
    closeModalButton.addEventListener('click', () => {
        itemRevealModal.classList.remove('show');
        setTimeout(() => {
          itemRevealModal.style.display = 'none';
        }, parseFloat(getComputedStyle(itemRevealModal).transitionDuration) * 1000 || 300);
    });
}
if (itemRevealModal) {
    itemRevealModal.addEventListener('click', (e) => {
        if (e.target === itemRevealModal && closeModalButton) closeModalButton.click();
    });
}


// --- Owned Items (Display with real-time listener) ---
function setupOwnedItemsListener(userId) {
    if (ownedItemsLoader) ownedItemsLoader.style.display = 'block';
    if (ownedItemsList) ownedItemsList.innerHTML = '';

    if (window.itemsUnsubscribe) {
        window.itemsUnsubscribe();
    }
    currentUserItemGroups.clear(); // Clear before populating

    window.itemsUnsubscribe = db.collection("users").doc(userId)
        .onSnapshot((doc) => {
            if (ownedItemsLoader) ownedItemsLoader.style.display = 'none';
            if (ownedItemsList) ownedItemsList.innerHTML = "";
            currentUserItemGroups.clear();

            if (doc.exists) {
                const userData = doc.data();
                let items = userData.ownedItems || [];

                if (items.length === 0) {
                    if (ownedItemsList) ownedItemsList.innerHTML = "<p style='text-align:center; width:100%;'>Your inventory is empty. Open some crates!</p>";
                    if (openItemRequestModalButton) openItemRequestModalButton.disabled = true;
                } else {
                    if (openItemRequestModalButton) openItemRequestModalButton.disabled = false;

                    items.sort((a, b) => {
                        const timeA = a.acquiredAt && a.acquiredAt.toDate ? a.acquiredAt.toDate().getTime() : 0;
                        const timeB = b.acquiredAt && b.acquiredAt.toDate ? b.acquiredAt.toDate().getTime() : 0;
                        return timeB - timeA;
                    });

                    items.forEach(item => {
                        const itemId = item.itemId || `unknown_item_${item.name || 'no_name'}_${Date.now()}`; // Fallback key
                        if (currentUserItemGroups.has(itemId)) {
                            currentUserItemGroups.get(itemId).count++;
                            // Update details to the most recent one if its timestamp is newer
                            if (item.acquiredAt && (!currentUserItemGroups.get(itemId).details.acquiredAt || item.acquiredAt.toMillis() > currentUserItemGroups.get(itemId).details.acquiredAt.toMillis())) {
                                currentUserItemGroups.get(itemId).details = { ...item };
                            }
                        } else {
                            currentUserItemGroups.set(itemId, { details: { ...item }, count: 1 });
                        }
                    });

                    if (ownedItemsList) {
                        Array.from(currentUserItemGroups.values()).forEach(group => {
                            const itemCard = createOwnedItemCardElement(group.details, group.count, false);
                            ownedItemsList.appendChild(itemCard);
                        });
                    }
                }
            } else {
                if (ownedItemsList) ownedItemsList.innerHTML = "<p style='text-align:center; width:100%;'>Could not load your items. User data not found.</p>";
                if (openItemRequestModalButton) openItemRequestModalButton.disabled = true;
            }
        }, error => {
            if (ownedItemsLoader) ownedItemsLoader.style.display = 'none';
            console.error("Error with owned items listener:", error);
            if (ownedItemsList) ownedItemsList.innerHTML = "<p style='text-align:center; width:100%;'>Error loading items. Try refreshing.</p>";
            showToast(`Error fetching items: ${error.message}`, 'error');
            if (openItemRequestModalButton) openItemRequestModalButton.disabled = true;
        });
}

function createOwnedItemCardElement(item, count, isSelectableContext = false) {
    const itemCard = document.createElement("div");
    itemCard.classList.add("owned-item-card");

    const rarityClass = item.rarity ? item.rarity.toLowerCase().replace(/\s+/g, '-') : 'common';
    let acquiredDateString = '';
    if (item.acquiredAt && typeof item.acquiredAt.toDate === 'function') {
        try {
            acquiredDateString = `<p class="item-acquired-date"><small>Last Acquired: ${item.acquiredAt.toDate().toLocaleDateString()}</small></p>`;
        } catch (e) {
            console.warn("Could not format acquiredAt date for item:", item.name, e);
        }
    }

    itemCard.innerHTML = `
        <img src="${item.imageUrl || 'https://via.placeholder.com/100x100?text=Item'}" alt="${item.name}" class="item-image">
        <h4>${item.name || 'Unknown Item'}</h4>
        <p class="item-rarity ${rarityClass}">${item.rarity || 'Unknown Rarity'}</p>
        ${item.description ? `<p class="item-desc-small">${item.description.substring(0,50)}${item.description.length > 50 ? '...' : ''}</p>` : ''}
        ${acquiredDateString}
        ${count > 1 ? `<div class="item-count">x${count}</div>` : ''}
    `;

    if (isSelectableContext) {
        const itemId = item.itemId || `unknown_item_${item.name || 'no_name'}_${Date.now()}`; // Ensure this matches the grouping key logic
        itemCard.dataset.itemId = itemId;

        itemCard.addEventListener('click', () => {
            toggleItemSelectionForRequest(itemCard, itemId, item, count);
        });

        if (selectedItemsForRequest.has(itemId)) {
            itemCard.classList.add('selected');
        }
    }
    return itemCard;
}

function toggleItemSelectionForRequest(cardElement, itemId, itemDetails, availableCount) {
    if (selectedItemsForRequest.has(itemId)) {
        selectedItemsForRequest.delete(itemId);
        cardElement.classList.remove('selected');
    } else {
        selectedItemsForRequest.set(itemId, { details: { ...itemDetails }, count: availableCount });
        cardElement.classList.add('selected');
    }
}


// --- Item Request Modal Logic ---
if (openItemRequestModalButton) {
    openItemRequestModalButton.addEventListener('click', () => {
        if (currentUserItemGroups.size === 0) {
            showToast("You have no items in your collection to request.", "info");
            return;
        }

        if (poxelUsernameInput) poxelUsernameInput.value = '';
        // selectedItemsForRequest.clear(); // Decided to persist selection for now, modal re-render handles visual update

        if (requestableItemsList) requestableItemsList.innerHTML = '';
        if (requestableItemsLoader) requestableItemsLoader.style.display = 'block';

        if (currentUserItemGroups.size > 0 && requestableItemsList) {
            Array.from(currentUserItemGroups.values()).forEach(group => {
                const itemCard = createOwnedItemCardElement(group.details, group.count, true);
                requestableItemsList.appendChild(itemCard);
            });
        } else if (requestableItemsList) {
            requestableItemsList.innerHTML = "<p style='text-align:center;'>No items available to select.</p>";
        }

        if (requestableItemsLoader) requestableItemsLoader.style.display = 'none';
        if (itemRequestModal) {
            itemRequestModal.style.display = 'flex';
            itemRequestModal.classList.add('show');
        }
    });
}

if (closeRequestModalButton) {
    closeRequestModalButton.addEventListener('click', () => {
        if (itemRequestModal) {
            itemRequestModal.classList.remove('show');
            setTimeout(() => {
              itemRequestModal.style.display = 'none';
            }, parseFloat(getComputedStyle(itemRequestModal).transitionDuration) * 1000 || 300);
        }
    });
}

if (itemRequestModal) {
    itemRequestModal.addEventListener('click', (e) => {
        if (e.target === itemRequestModal && closeRequestModalButton) closeRequestModalButton.click();
    });
}

if (submitItemRequestButton) {
    submitItemRequestButton.addEventListener('click', async () => {
        const poxelUsername = poxelUsernameInput ? poxelUsernameInput.value.trim() : '';
        const user = auth.currentUser;

        if (!user) {
            showToast("You must be logged in to submit a request.", "error");
            return;
        }
        if (!poxelUsername) {
            showToast("Please enter your Poxel Username.", "error");
            if (poxelUsernameInput) poxelUsernameInput.focus();
            return;
        }
        if (selectedItemsForRequest.size === 0) {
            showToast("Please select at least one item to request.", "error");
            return;
        }

        const originalButtonHTML = submitItemRequestButton.innerHTML;
        toggleButtonLoading(submitItemRequestButton, true, originalButtonHTML);

        let emailBody = `Poxel.io In-Game Item Request:\n\n`;
        emailBody += `Firebase User Email: ${user.email}\n`;
        emailBody += `Firebase User UID: ${user.uid}\n`;
        emailBody += `Poxel Username (In-Game): ${poxelUsername}\n\n`;
        emailBody += `Requested Items (Name - Rarity - Quantity):\n`;
        emailBody += `------------------------------------------\n`;

        selectedItemsForRequest.forEach((itemData) => {
            const name = itemData.details.name || 'Unknown Item';
            const rarity = itemData.details.rarity || 'N/A';
            const count = itemData.count;
            emailBody += `- ${name} (${rarity}) x ${count}\n`;
        });
        emailBody += `------------------------------------------\n`;
        emailBody += `\nPlease verify and provision these items in-game for the Poxel Username above.\n`;
        emailBody += `Timestamp (UTC): ${new Date().toISOString()}\n`;

        // !!! IMPORTANT: Replace with YOUR admin email address !!!
        const adminEmail = "trixdesignsofficial@gmail.com"; // <<<<<<<<<<<<<<<<<<< REPLACE THIS
        const emailSubject = `Poxel Item Request: ${poxelUsername} (${user.email})`;

        const mailtoLink = `mailto:${adminEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

        const mailOpener = document.createElement('a');
        mailOpener.href = mailtoLink;
        mailOpener.click();

        showToast("Request email prepared! Please check your email client to send it.", 'success');

        selectedItemsForRequest.clear();
        if (poxelUsernameInput) poxelUsernameInput.value = '';
        if (requestableItemsList) {
             requestableItemsList.querySelectorAll('.owned-item-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
        }

        if (closeRequestModalButton) closeRequestModalButton.click();
        toggleButtonLoading(submitItemRequestButton, false, originalButtonHTML);
    });
}

// Initial state setup
if (auth.currentUser) {
    if (authSection) authSection.style.display = 'none';
    if (userContentSection) userContentSection.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'inline-flex';
    if (openItemRequestModalButton) {
        openItemRequestModalButton.style.display = 'inline-flex';
        openItemRequestModalButton.disabled = true; // Will be enabled by listener if items exist
    }
} else {
    if (openItemRequestModalButton) openItemRequestModalButton.style.display = 'none';
}
console.log("Poxel Nexus App.js loaded with item stacking and request system.");
