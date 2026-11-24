# Kazi User & Business Flow Diagrams (Phase D0a)

**Specification Edition**: 2.0.0  
**Target Release**: 1.0.0 (Gabon Launch)

---

## 1. Core Worker Journey: Apply to Final Assignment

```mermaid
sequenceDiagram
    autonumber
    actor W as Ouvrier
    participant App as Interface Kazi
    actor Staff as Recruteur Kazi
    actor C as Entreprise

    W->>App: Découverte missions ouvertes (Libreville, Métier, Date)
    W->>App: Consultation détail mission & révision des termes
    Note over W,App: Confirmation des conditions : Rémunération directe, 0 FCFA de frais ouvrier
    W->>App: Postuler (Soumission candidature unique)
    App-->>W: Statut: SUBMITTED (En attente de présélection)

    Staff->>App: Examen du vivier de candidatures éligibles
    Staff->>App: Présélection (SHORTLISTED) puis Proposition à l'entreprise (PROPOSED)
    
    C->>App: Notification nouveau profil proposé (Compétences, Expérience, Zone)
    Note over C,App: Coordonnées privées et documents masqués
    C->>App: Décision Entreprise : ACCEPTED
    
    App-->>W: Notification : Offre de mission disponible (délai expiration 24h)
    W->>App: Examen des termes scellés (identiques)
    W->>App: Décision Ouvrier : CONFIRMED
    Note over App: Statut proposition : READY_FOR_ASSIGNMENT

    Staff->>App: Contrôle capacité restante & anti-chevauchement de planning
    Staff->>App: Finalisation atomique du placement (ASSIGNED)
    App-->>W: Mission confirmée avec feuille de route et accès au pointage
    App-->>C: Équipe mission mise à jour avec affectation validée
```

---

## 2. Company Staffing Request to Publication Flow

```mermaid
flowchart TD
    Start([Nouvelle Demande Entreprise]) --> Step1[Étape 1 : Définition du Métier & Effectif requis]
    Step1 --> Step2[Étape 2 : Lieu du Chantier & Calendrier]
    Step2 --> Step3[Étape 3 : Taux journalier direct XAF & Équipements EPI]
    Step3 --> Draft[Sauvegarde automatique : Statut DRAFT]
    Draft --> Review[Récapitulatif des conditions contractuelles]
    Review --> Submit[Action : 'Envoyer à Kazi' -> Statut SUBMITTED]
    
    Submit --> StaffReview{Examen par le Recruteur Kazi}
    StaffReview -->|Informations incomplètes / Taux non conforme| ChangesReq[Statut CHANGES_REQUESTED : Demande de corrections]
    ChangesReq --> Draft
    
    StaffReview -->|Entreprise vérifiée & Termes valides| Approved[Statut APPROVED]
    Approved --> Publish[Action Staff : 'Publier la mission']
    Publish --> TxPublish[(Transaction Atomique : Création Mission OPEN + Scellement Termes v1)]
    TxPublish --> PublicMissions[Visible par les ouvriers dans Découverte]
```

---

## 3. Human Selection & Dual Confirmation Gate (Invariant KZ08 & KZ09)

```mermaid
flowchart LR
    subgraph SelectionStaff ["1. Sélection Humaine Kazi (KZ07)"]
        Pool[Vivier Candidats SUBMITTED] --> Verify[Contrôle critères éligibilité & disponibilité]
        Verify --> Shortlist[Statut SHORTLISTED]
        Shortlist --> Propose[Action Recruteur : Proposer à l'Entreprise]
    end

    subgraph DecisionCompany ["2. Décision Entreprise (KZ08)"]
        Propose --> CoView[Examen profil anonymisé]
        CoView --> CoDecision{Décision Entreprise}
        CoDecision -->|Refusé| CoDeclined[Proposition DECLINED]
        CoDecision -->|Validé| CoAccepted[companyDecision: ACCEPTED]
    end

    subgraph DecisionWorker ["3. Confirmation Ouvrier (KZ08)"]
        CoAccepted --> WNotif[Invitation Ouvrier transmise]
        WNotif --> WCountdown[Compte à rebours 24h avant expiration]
        WCountdown --> WDecision{Décision Ouvrier}
        WDecision -->|Délai expiré ou Refus| WDeclined[workerDecision: DECLINED / EXPIRED]
        WDecision -->|Accord sur termes identiques| WConfirmed[workerDecision: CONFIRMED]
    end

    subgraph AtomicFinalize ["4. Finalisation Kazi (KZ09)"]
        WConfirmed --> Ready[Statut Proposition : READY_FOR_ASSIGNMENT]
        Ready --> AdminLock[Recruteur Kazi : Verrou atomique & Contrôle capacité]
        AdminLock --> AssignmentSuccess[Création ASSIGNMENT : CONFIRMED]
    end

    style AtomicFinalize fill:#e8f4ec,stroke:#0b5d3b,stroke-width:2px;
```

---

## 4. Daily Attendance & Dispute Resolution (KZ10)

```mermaid
flowchart TD
    DayStart([Journée de Mission]) --> DefaultState[Statut initial : NOT_RECORDED]
    DefaultState --> CompanyDeclare[Pointage Entreprise : PRÉSENT / ABSENT / PARTIEL + Heures]
    CompanyDeclare --> AttSubmitted[Déclaration enregistrée : Statut SUBMITTED_BY_COMPANY]
    
    AttSubmitted --> WorkerCheck{Examen par l'Ouvrier}
    WorkerCheck -->|Conforme| WorkerConfirm[Confirmation Ouvrier -> Statut CONFIRMED]
    WorkerCheck -->|Désaccord sur heures ou statut| WorkerDispute[Contestation Ouvrier -> Statut DISPUTED]
    
    WorkerDispute --> RecruiterIntervene[Intervention Recruteur Kazi]
    RecruiterIntervene --> GatherProof[Examen des éléments déclarés & échange support]
    GatherProof --> StaffResolve[Arbitrage Staff motivé -> Statut RESOLVED_BY_STAFF]
    StaffResolve --> AuditLog[(Enregistrement audit immuable avec motif)]
    WorkerConfirm --> ReadyForClose[Prêt pour bilan de mission KZ13]
    StaffResolve --> ReadyForClose
```

---

## 5. Worker Replacement Workflow (KZ11)

```mermaid
flowchart TD
    AbsenceDetected([Absence constatée ou signalée]) --> AbsenceReport[Signalement par Ouvrier ou Entreprise]
    AbsenceReport --> StaffAlert[Alerte file prioritaire Recruteur Kazi]
    StaffAlert --> ScopeDates[Identification précise des dates vacantes concernées]
    
    ScopeDates --> CapacityAdjust[Ajustement ciblé de la capacité de créneau pour les dates concernées]
    CapacityAdjust --> FindCandidate[Sélection accélérée dans le vivier d'ouvriers vérifiés disponibles]
    FindCandidate --> ProposeNew[Proposition du candidat remplaçant à l'entreprise]
    
    ProposeNew --> CoApproval[Validation Entreprise]
    CoApproval --> WConfirm[Confirmation Ouvrier remplaçant]
    WConfirm --> LinkAssignments[(Liaison dans l'audit : Ancien assigné + Nouveau remplaçant)]
    LinkAssignments --> ScheduleLocked[Verrouillage du calendrier sans risque de surréservation]
```

---

## 6. Theme Switching Architecture (Zero Impact on Domain Business Rules)

```mermaid
flowchart TD
    subgraph ConfigLayer ["Couche Configuration / Présentation"]
        Registry[config/registry.json] --> GAConfig[GA-1.0.0.json : Gabon Launch]
        GAConfig --> DefTheme[gabon-premium@1.0.0]
        GAConfig --> AltTheme[forest-premium@1.0.0]
        DefTheme --> TokenResolver[Injecteur de Jetons Sémantiques :root]
        AltTheme --> TokenResolver
        TokenResolver --> CSSVars[Variables CSS : --color-primary, --color-surface, etc.]
    end

    subgraph SharedComponents ["Composants UI Partagés"]
        CSSVars --> Button[Boutons, Cartes, Badges, Modales, Tables]
        Button --> MobileView[Vue Mobile 360px]
        Button --> TabletView[Vue Tablette 768px]
        Button --> DesktopView[Vue Bureau 1440px]
    end

    subgraph InvariantDomain ["Domaine Métier Immuable"]
        DomainRules["Règles Métier Stables :
        - 0 FCFA de frais ouvrier
        - Rémunération directe par l'entreprise
        - Double validation obligatoire (KZ08)
        - Finalisation atomique staff (KZ09)
        - Masquage des données privées CNI/Téléphone"]
    end

    CSSVars -.->|Présentation seule| InvariantDomain
    style InvariantDomain fill:#f7f7f2,stroke:#53645d,stroke-width:2px;
```
