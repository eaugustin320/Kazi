# Kazi Screen Inventory Matrix (Phase D0a)

**Specification Edition**: 2.0.0  
**Target Release**: 1.0.0 (Gabon Launch)  
**Standard**: WCAG 2.2 AA, Touch target ≥ 44px, Responsive breakpoints: 360px (mobile), 768px (tablet), 1024px/1440px (desktop)

---

## 1. Worker Screens (Role: Worker / Public Visitor)

| Screen ID | Screen Name | Route / Path | KZ ID | Primary Action | Required UI States |
|---|---|---|---|---|---|
| **W-01** | Accueil / Connexion | `/worker/login` | KZ01 | Saisir numéro de téléphone (+241) & Demander code OTP | Default, Saisie valide, Format invalide, Envoi en cours, Erreur réseau, Compte suspendu |
| **W-02** | Vérification OTP | `/worker/verify-otp` | KZ01 | Confirmer le code SMS à 6 chiffres | Default, Code valide (auto-submit), Code erroné, Code expiré, Renvoyer le code (countdown), Trop de tentatives |
| **W-03** | Profil & Compétences | `/worker/profile` | KZ01 | Mettre à jour profil (métiers, zone, disponibilités) | Initial loading, Consultatif, Mode édition, Sauvegarde en cours, Succès, Validation erreur, Pièces d'identité (statut uniquement) |
| **W-04** | Découverte des Missions | `/worker/missions` | KZ05 | Filtrer par métier, commune (Libreville) et date | Squelette de chargement, Liste peuplée, Aucun résultat (empty state filtré), Erreur de chargement / Réessayer |
| **W-05** | Détail de la Mission | `/worker/missions/:id` | KZ04, KZ05, KZ06 | Postuler à la mission (ou voir état de candidature) | Chargement, Fiche mission détaillée (conditions, rémunération XAF directe par entreprise, zéro frais ouvrier), Bouton postuler actif, Déjà postulé, Mission clôturée |
| **W-06** | Postuler / Confirmation | `/worker/missions/:id/apply` | KZ06 | Confirmer la soumission de candidature | Dialogue de confirmation, En cours de soumission, Succès de soumission, Erreur doublon (déjà postulé), Erreur compte restreint |
| **W-07** | Mes Candidatures | `/worker/applications` | KZ06, KZ07 | Suivre le statut de ses candidatures et propositions | Chargement, Liste vide, Liste peuplée avec badges (Soumise, Présélectionnée, Proposée, Assignée, Non retenue, Retirée) |
| **W-08** | Confirmation de Disponibilité | `/worker/proposals/:id/confirm` | KZ08 | Accepter / Confirmer la disponibilité (ou Refuser) | Compte à rebours 24h, Révision des termes identiques, Explication claire (l'acceptation ouvrier n'est pas encore l'assignation finale), Succès, Déjà expiré, Déjà confirmé |
| **W-09** | Retrait de Candidature | Modal sur `/worker/applications/:id` | KZ06 | Confirmer le retrait volontaire | Dialogue de confirmation avec motif, Traitement, Succès avec impossibilité de réactivation automatique |
| **W-10** | Mission Active & Feuille de Route | `/worker/assignments/:id` | KZ09, KZ10 | Consulter site, horaires, consignes et pointer présence | Détails complets, Termes scellés, Déclaration de présence du jour (Confirmée, Contestée), Signaler une absence |
| **W-11** | Signalement d'Absence | Modal sur `/worker/assignments/:id/absence` | KZ11 | Déclarer une absence pour une ou plusieurs dates | Sélection des dates affectées, Motif, Avertissement impact, Envoi, Prise en compte staff |
| **W-12** | Historique & Bilan | `/worker/history` | KZ10, KZ13 | Consulter les missions passées et bilans de présence | Liste vide, Liste historique, Bilan par mission (jours pointés, litiges résolus) |
| **W-13** | Support & Messages Kazi | `/worker/support` | KZ12 | Ouvrir un ticket d'assistance ou échanger avec Kazi | Liste des conversations, Fil de discussion actif, Formulaire de nouveau message, Statut (Ouvert, En cours, Résolu) |
| **W-14** | Notifications | `/worker/notifications` | KZ15 | Consulter les alertes opérationnelles | Liste de notifications horodatées, Tout marquer comme lu, État vide, Lien direct vers l'action requise |

---

## 2. Company Screens (Role: Company Owner)

| Screen ID | Screen Name | Route / Path | KZ ID | Primary Action | Required UI States |
|---|---|---|---|---|---|
| **C-01** | Connexion & Inscription Entreprise | `/company/login`, `/company/register` | KZ02 | Connexion / Création de compte entreprise | Formulaire initial, Validation RCCM / NIF, Envoi, Erreur identifiants, Mot de passe oublié |
| **C-02** | Statut & Documents Entreprise | `/company/verification` | KZ02 | Téléverser Fiche Circuit / RCCM et suivre validation | En attente de vérification, Documents requis manquants, Documents soumis sous revue, Entreprise vérifiée, Corrections demandées |
| **C-03** | Vue d'ensemble (Dashboard) | `/company/overview` | KZ03, KZ07, KZ08 | Voir demandes actives et profils proposés en attente | Chargement, Aucun élément actif (guide de première demande), Alertes d'actions requises (candidats à valider, pointage du jour) |
| **C-04** | Créer une Demande (Multi-étapes) | `/company/requests/new` | KZ03 | Étape 1 (Besoin) -> Étape 2 (Lieu/Dates) -> Étape 3 (Tarif XAF/Équipement) -> Envoyer à Kazi | Étape active, Sauvegarde automatique du brouillon (DRAFT), Validation de chaque étape, Récapitulatif, Envoi à Kazi (SUBMITTED) |
| **C-05** | Liste des Demandes | `/company/requests` | KZ03, KZ04 | Suivre l'état des demandes transmises à Kazi | Liste filtrable par statut (Brouillon, Soumise, Sous revue Kazi, Approuvée, Corrections requises, Annulée) |
| **C-06** | Candidats Proposés par Kazi | `/company/requests/:id/proposals` | KZ07, KZ08 | Évaluer les profils présélectionnés par l'équipe Kazi | Liste des profils partagés (compétences, zone, expérience déclarée - ZÉRO téléphone ni document d'identité personnel), Actions Accepter / Décliner |
| **C-07** | Décision sur Proposition | Modal sur `/company/proposals/:id/decide` | KZ08 | Valider l'acceptation ou le refus du candidat | Avertissement légal : "L'acceptation entreprise déclenche l'invitation de l'ouvrier, sous réserve de sa confirmation et de la finalisation par Kazi", Confirmation, Rejet avec motif |
| **C-08** | Roster Mission & Pointage Présence | `/company/missions/:id/attendance` | KZ10 | Pointer la présence quotidienne de l'équipe (Présent / Absent / Partiel) | Grille journalière par ouvrier, Saisie heures / motif, Sauvegarde, Historique des modifications, Litige signalé par ouvrier |
| **C-09** | Demande de Remplacement | Modal sur `/company/missions/:id/replace` | KZ11 | Signaler une absence et demander un remplaçant à Kazi | Sélection de l'ouvrier absent et des dates concernées, Motif, Transmission aux recruteurs Kazi |
| **C-10** | Devis & Factures Kazi | `/company/invoices` | KZ14 | Consulter et télécharger les factures de service Kazi | Mention explicite "SAMPLE / SPÉCIMEN" en prototype, Décomposition frais Kazi (hors salaires directs), Téléchargement reçu |
| **C-11** | Assistance Entreprise | `/company/support` | KZ12 | Contacter le coordinateur Kazi dédié | Liste des échanges, Envoi de message, Prise en charge par l'équipe d'exploitation |

---

## 3. Administration & Staff Screens (Role: Recruiter, Finance, Admin)

| Screen ID | Screen Name | Route / Path | KZ ID | Primary Action | Required UI States |
|---|---|---|---|---|---|
| **A-01** | Connexion Staff & MFA | `/admin/login` | PRD Sec | Authentification sécurisée staff | Saisie identifiant, Saisie code MFA, Session expirée, Accès refusé (aucun rôle staff) |
| **A-02** | File Prioritaire "À Traiter" | `/admin/queue` | KZ03, KZ07, KZ08, KZ11 | Traiter par ordre d'urgence les actions opérationnelles | Compteurs de file, Demandes en attente de modération, Profils à proposer, Confirmations prêtes à finaliser, Litiges d'assiduité |
| **A-03** | Modération & Publication de Demande | `/admin/requests/:id` | KZ03, KZ04 | Valider la demande, demander des corrections, ou Publier la mission | Examen conformité entreprise, Vérification termes (salaire direct, lieu Libreville, EPI), Bouton "Publier la mission" (transaction atomique de publication) |
| **A-04** | Vivier Ouvriers & Vérification | `/admin/workers` | KZ01, KZ07 | Examiner les profils, vérifier les pièces d'identité et notes internes | Recherche avancée, Distinguer "Identité vérifiée" de "Compétences auto-déclarées", Bloc de notes internes privées (strictement invisibles des entreprises) |
| **A-05** | Sélection & Proposition de Candidats | `/admin/missions/:id/matching` | KZ07 | Présélectionner des ouvriers éligibles et "Proposer à l'entreprise" | Tableau de matching avec compteur persistant d'ouvriers sélectionnés, Vérification anti-chevauchement de calendrier, Action grouper proposition |
| **A-06** | Finalisation des Assignations | `/admin/missions/:id/finalization` | KZ08, KZ09 | Finaliser l'assignation ferme de l'ouvrier | Vérification indépendante de la validation entreprise ET de la confirmation ouvrier sur la même version de termes, Contrôle capacité restante, Finalisation atomique |
| **A-07** | Suivi Présence & Résolution de Litiges | `/admin/missions/:id/attendance` | KZ10, KZ13 | Arbitrer un désaccord de pointage entre entreprise et ouvrier | Vue comparative pointage entreprise vs contestation ouvrier, Décision motivée enregistrée dans l'audit, Clôture de bilan |
| **A-08** | Gestion des Remplacements | `/admin/replacements` | KZ11 | Proposer un remplaçant pour les dates vacantes | Fiche d'incident d'absence, Déverrouillage partiel de capacité, Proposition accélérée d'un nouvel ouvrier sans fabrication de faux consentement |
| **A-09** | Facturation de Service Kazi | `/admin/billing` | KZ14 | Émettre devis/facture de service et enregistrer un reçu vérifié | Liste factures, Enregistrement référence reçu bancaire externe, Rapprochement comptable, Interdiction absolue d'inclure les salaires ouvriers |
| **A-10** | Paramètres Pays & Thèmes | `/admin/settings/themes` | KZ16 | Prévisualiser et activer auditablement un thème | Sélecteur de thème (`gabon-premium@1.0.0` vs `forest-premium@1.0.0`), Tableau de bord des contrastes WCAG, Simulation d'activation avec motif obligatoire |
| **A-11** | Journal d'Audit Opérationnel | `/admin/audit` | KZ17 | Consulter l'historique immuable des actions sensibles | Liste chronologique immuable : Horodatage UTC, Acteur, Rôle, Action, Ancienne valeur, Nouvelle valeur, Données privées caviardées |

---

## 4. Invariant UX & Access Standards Across All Screens

1. **Rémunération directe** : Chaque vue affichant une rémunération rappelle le principe : *Paiement direct entreprise -> ouvrier. Zéro commission déduite du salaire.*
2. **Protection de la vie privée** : Les coordonnées privées (téléphone, NIP, CNI) ne transitent jamais vers l'interface entreprise. Seuls le prénom, l'initiale du nom, la commune, les compétences et les expériences pertinentes sont exposés.
3. **Double confirmation** : L'acceptation d'une entreprise ne produit jamais une assignation directe. Elle transmet une invitation de disponibilité à l'ouvrier avec un délai de 24h. Le recruteur Kazi finalise l'assignation de manière atomique.
4. **Indépendance sémantique des thèmes** : Le passage de `gabon-premium` à `forest-premium` change exclusivement les variables CSS de présentation (`--color-primary`, `--color-accent`, etc.). Aucune donnée métier, règle de transition ou permission n'est altérée.
