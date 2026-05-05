export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: "savjeti" | "destinacije" | "vijesti";
  coverImage: string;
  date: string;
  readTime: number; // minutes
  author: string;
}

export const CATEGORIES = {
  savjeti: "Savjeti",
  destinacije: "Destinacije",
  vijesti: "Vijesti",
} as const;

export const blogPosts: BlogPost[] = [
  {
    slug: "top-destinacije-crna-gora",
    title: "Top 7 destinacija u Crnoj Gori koje morate posjetiti",
    excerpt:
      "Od plaža Budve do planina Durmitora — otkrijte zašto je sopstveni automobil ključ slobode na Balkanu.",
    content: `
# Top 7 destinacija u Crnoj Gori koje morate posjetiti

Crna Gora je mala zemlja, ali nudi nevjerovatnu raznolikost pejzaža. Sa iznajmljenim automobilom možete za jedan dan proći od morske obale do alpskih vrhova.

## 1. Kotor — Grad u fjordu

Kotor je jedno od najljepših srednjovjekovnih gradova na Jadranskom moru. Opkoljen moćnim zidinama, smješten u dubini Bokokotorskog zaliva...

## 2. Durmitor — Planinski raj

Nacionalni park Durmitor nudi spektakularne panorame, Crno jezero i Taru — najdublji kanjon u Evropi...

## 3. Budva — Rivijera puna života

Stara gradska jezgra i kilometri plaža čine Budvu najposjećenijom turističkom destinacijom...

## 4. Cetinje — Istorijska prijestolnica

Bivša kraljevska prijestolnica čuva bogato kulturno nasljeđe kroz muzeje i palate...

## 5. Žabljak — Kapija Durmitora

Grad na 1.450 metara nadmorske visine — polazna tačka za planinska istraživanja...

## 6. Ulcinj — Na granici sa Albanijom

Najjužniji grad Crne Gore sa dugačkom Velikom plažom i orijentalnim nasljeđem...

## 7. Biogradska gora — Prašuma Evrope

Jedna od samo tri preostale prašume u Evropi, dom Biograd jezera...
    `,
    category: "destinacije",
    coverImage:
      "https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=800&q=80",
    date: "2025-04-15",
    readTime: 6,
    author: "AdriaDrive Team",
  },
  {
    slug: "savjeti-iznajmljivanje-automobila",
    title: "10 savjeta za iznajmljivanje automobila na Balkanu",
    excerpt:
      "Sve što trebate znati prije nego potpišete ugovor — od osiguranja do goriva i graničnih prelaza.",
    content: `
# 10 savjeta za iznajmljivanje automobila na Balkanu

Iznajmljivanje automobila može biti veoma jednostavno ako znate šta tražiti. Evo naših provjerenih savjeta.

## 1. Rezervišite unaprijed

U ljetnoj sezoni vozila se rasprodaju brzo. Preporučujemo rezervaciju najmanje 2 sedmice unaprijed...

## 2. Provjerite uslove osiguranja

Osnovno osiguranje pokriva štetu od sudara, ali ne i krađu ili oštećenje guma...

## 3. Fotografišite vozilo prije preuzimanja

Dokumentujte svako ogrebotinje i udubinu prije nego napustite parkig...

## 4. Pitajte o politici goriva

Najčešće se prima pun, vraća pun — ali uvijek provjerite...
    `,
    category: "savjeti",
    coverImage:
      "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    date: "2025-03-28",
    readTime: 8,
    author: "AdriaDrive Team",
  },
  {
    slug: "nova-flota-2025",
    title: "AdriaDrive predstavlja novu flotu za sezonu 2025",
    excerpt:
      "Proširujemo ponudu sa 15 novih vozila uključujući električna i hibridna — za putovanje bez emisija.",
    content: `
# AdriaDrive predstavlja novu flotu za sezonu 2025

Sa ponosom najavljujemo proširenje naše flote za predstojeću turističku sezonu.

## Šta je novo?

Ove godine dodajemo 15 novih vozila, uključujući:

- **Tesla Model 3** — električno, za ekološki svjesne putnike
- **Toyota Corolla Hybrid** — ekonomičnost na dugim trasama  
- **Škoda Kodiaq** — idealan za porodična putovanja
- **Volkswagen Transporter** — za grupna putovanja do 9 putnika

## Dostava na više lokacija

Od ove sezone nudi dostavu i preuzimanje na aerodromima Tivat, Podgorica i Dubrovnik...
    `,
    category: "vijesti",
    coverImage:
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
    date: "2025-03-10",
    readTime: 4,
    author: "AdriaDrive Team",
  },
  {
    slug: "ruta-balkanska-tura",
    title: "Balkanska tura: Crna Gora → Albanija → Bosna za 10 dana",
    excerpt:
      "Predlažemo rutu za nezaboravno rodno putovanje kroz tri balkanske države u jednoj vožnji.",
    content: `
# Balkanska tura: 10 dana kroz tri države

Sa AdriaDrive vozilom možete slobodno prelaziti granice između Crne Gore, Albanije i Bosne i Hercegovine.

## Dan 1-3: Crna Gora

Počnite od Podgorice, posjetite Kotor, Budvu i Cetinje...

## Dan 4-6: Albanija

Prelaz u Albaniju kroz Skadar — posjetite Shkodër, Albansku rivijeru i Tiranu...

## Dan 7-10: Bosna i Hercegovina

Mostarski most, Sarajevo, Trebinje...
    `,
    category: "destinacije",
    coverImage:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    date: "2025-02-20",
    readTime: 10,
    author: "AdriaDrive Team",
  },
  {
    slug: "zimske-gume-planine",
    title: "Zimske gume i planinska vožnja — šta trebate znati",
    excerpt:
      "Ako planirate posjetiti Durmitor ili Bjelasicu zimi, evo zašto su zimske gume obavezne i kako mi brinemo o sigurnosti.",
    content: `
# Zimske gume i planinska vožnja

Crna Gora ima iznenađujuće zahtjevne planinske puteve u zimskim mjesecima.

## Kada su zimske gume obavezne?

U Crnoj Gori zimska oprema je zakonski obavezna od 15. novembra do 31. marta...

## Naša vozila u zimskom periodu

Sva naša vozila u zimskoj sezoni opremljena su certificiranim zimskim gumama...
    `,
    category: "savjeti",
    coverImage:
      "https://images.unsplash.com/photo-1491555103944-7c647fd857e6?w=800&q=80",
    date: "2025-01-15",
    readTime: 5,
    author: "AdriaDrive Team",
  },
  {
    slug: "aerodrom-tivat-preuzimanje",
    title: "Kako funkcioniše preuzimanje vozila na aerodromu Tivat",
    excerpt:
      "Korak po korak vodič — od slijetanja do ključeva u ruci, bez čekanja i komplikacija.",
    content: `
# Preuzimanje vozila na aerodromu Tivat

Tivat aerodrom je najposjećenija tačka ulaska u Crnu Goru tokom ljeta. Evo kako organizujemo preuzimanje.

## Korak 1: Potvrdite rezervaciju

24h prije dolaska pošaljite nam broj leta...

## Korak 2: Naš predstavnik vas čeka

Na izlazu iz terminala naći ćete osobu sa AdriaDrive tablom...

## Korak 3: Preuzimanje vozila

Na parkingu aerodroma zajedno pregledamo vozilo i potpisujemo ugovor...
    `,
    category: "vijesti",
    coverImage:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",
    date: "2024-12-05",
    readTime: 4,
    author: "AdriaDrive Team",
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getPostsByCategory(
  category: BlogPost["category"]
): BlogPost[] {
  return blogPosts.filter((p) => p.category === category);
}

export function getAllPosts(): BlogPost[] {
  return [...blogPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("bs-BA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
