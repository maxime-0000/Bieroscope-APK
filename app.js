window.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://punkapi.dev/api/v3";
  const catalogue = document.querySelector("#catalogue");
  const statut = document.querySelector("#statut");
  const formulaire = document.querySelector("#recherche-form");
  const champNom = document.querySelector("#nom");
  const boutonCharger = document.querySelector("#charger");
  const boutonAleatoire = document.querySelector("#aleatoire");

  function afficherBieres(bieres) {
    catalogue.replaceChildren();

    for (const biere of bieres) {
      const carte = document.createElement("article");
      carte.className = "carte";

      const titre = document.createElement("h2");
      titre.textContent = biere.name ?? "Nom non renseigné";
      carte.append(titre);

      const description = document.createElement("p");
      description.textContent =
        biere.description ?? "Aucune description disponible.";
      carte.append(description);

      const tauxAlcool = document.createElement("p");
      tauxAlcool.textContent = `Taux d'alcool : ${biere.abv ?? "inconnu"}%`;
      carte.append(tauxAlcool);

      const ibu = document.createElement("p");
      ibu.textContent = `IBU : ${biere.ibu ?? "inconnu"}`;
      carte.append(ibu);

      if (biere.image) {
        const image = document.createElement("img");
        image.src = `${API_BASE}/images/${biere.image}`;
        image.alt = biere.name ?? "Image de bière";
        carte.append(image);
      }

      catalogue.append(carte);
    }

    statut.textContent = "Catalogue chargé.";
  }

  async function chargerCatalogue() {
    statut.textContent = "Chargement du catalogue...";

    let db;
    let bieresLocales = [];

    try {
      db = await initDB();

      bieresLocales = await getBeersFromDB(db);

      const response = await fetch(`${API_BASE}/beers?page=1&per_page=10`);

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const bieresAPI = await response.json();

      // Les bières de l'API et celles d'IndexedDB, sans doublons d'id
      const toutesLesBieres = new Map();

      for (const biere of bieresAPI) {
        toutesLesBieres.set(biere.id, biere);
      }

      for (const biere of bieresLocales) {
        toutesLesBieres.set(biere.id, biere);
      }

      const bieres = [...toutesLesBieres.values()];

      // Enregistre aussi les bières reçues de l'API
      await addBeersToDB(bieresAPI);

      afficherBieres(bieres);
    } catch (erreur) {
      console.error("Erreur lors du chargement :", erreur);
      if (bieresLocales.length > 0) {
        afficherBieres(bieresLocales);
        statut.textContent =
          "Catalogue chargé depuis les données enregistrées (API indisponible).";
      } else {
        statut.textContent =
          "Impossible de charger le catalogue. Vérifiez votre connexion puis réessayez.";
      }
    } finally {
      if (db) {
        db.close();
      }
    }
  }

  async function rechercherBieres(nom) {
    statut.textContent = "Recherche en cours…";

    const parametres = new URLSearchParams({
      page: "1",
      per_page: "10",
      beer_name: nom.trim().replace(/\s+/g, "_"),
    });

    const url = `${API_BASE}/beers?${parametres}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const bieres = await response.json();
      afficherBieres(bieres);

      if (bieres.length === 0) {
        statut.textContent = `Aucune bière trouvée pour « ${nom} ».`;
      }
    } catch (erreur) {
      console.error(erreur);
      statut.textContent = "La recherche a échoué.";
    }
  }

  async function chargerAleatoire() {
    statut.textContent = "Chargement d'une fiche au hasard…";

    try {
      const response = await fetch(`${API_BASE}/beers/random`);

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const biere = await response.json();

      afficherBieres([biere]);
      statut.textContent = "Carte aléatoire chargée.";
    } catch (erreur) {
      console.error(erreur);
      statut.textContent = "Impossible de charger une fiche au hasard.";
    }
  }

  boutonCharger.addEventListener("click", chargerCatalogue);
  // À compléter : écoute du formulaire et du bouton aléatoire.

  formulaire.addEventListener("submit", (event) => {
    event.preventDefault();

    const nom = champNom.value.trim();

    if (nom === "") {
      chargerCatalogue();
    } else {
      rechercherBieres(nom);
    }
  });

  boutonAleatoire.addEventListener("click", chargerAleatoire);
});

//indexDB

// Ouvre la base de données
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("biereDB", 4);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("biere")) {
        const store = db.createObjectStore("biere", { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Enregistre les bières reçues de l'API dans IndexedDB.
async function addBeersToDB(bieres) {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("biere", "readwrite");
    const store = transaction.objectStore("biere");
    for (const biere of bieres) {
      store.put(biere);
    }

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function getBeersFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("biere", "readonly");
    const request = transaction.objectStore("biere").getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")

    .then(() => console.log("SW enregistré"))

    .catch((error) => {
      console.error("Échec de l'enregistrement du Service Worker :", error);
      if (!window.isSecureContext) {
        document.querySelector("#statut").textContent =
          "Ouvre le site depuis localhost ou une adresse HTTPS pour activer l’installation.";
      }
    });
}

let installPrompt = null;
const installButton = document.querySelector("#install");
const statutInstallation = document.querySelector("#statut");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton?.removeAttribute("hidden");
});

installButton?.addEventListener("click", async () => {
  if (!installPrompt) {
    statutInstallation.textContent =
      "Aucune invite d’installation n’a été reçue. Vérifie localhost/HTTPS, le Service Worker et le manifeste; sinon, utilise le menu du navigateur.";
    return;
  }

  try {
    const promptEvent = installPrompt;
    installPrompt = null;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    statutInstallation.textContent = choice.outcome === "accepted"
      ? "Application installée."
      : "Installation annulée.";
  } catch (error) {
    console.error("Échec de l’installation :", error);
    statutInstallation.textContent = "Impossible de lancer l’installation.";
  } finally {
    installButton.setAttribute("hidden", "");
  }
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton?.setAttribute("hidden", "");
  statutInstallation.textContent = "Application installée.";
});
