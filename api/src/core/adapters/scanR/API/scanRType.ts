// 📍 Types de base
interface ExternalId {
    id: string;
    type: string;
}

interface GpsCoordinates {
    lat?: number;
    lon?: number;
}

interface Label {
    [key: string]: string; // Ex: { fr: "...", default: "..." }
}

// 🏠 Adresses
interface BaseAddress {
    main?: boolean;
    country?: string;
    city?: string;
    address?: string;
    postcode?: string;
    region?: string;
    gps?: GpsCoordinates;
}

export interface FullAddress extends BaseAddress {
    iso3?: string;
}

interface RorAddress extends Omit<BaseAddress, "iso3" | "region"> {
    iso2?: string;
}

interface MainAddress {
    address?: string;
    address_detected?: string;
    city?: string;
    postcode?: string;
    region?: string;
}

export interface Link {
    url?: string;
    type?: string;
    value?: string;
}

// 🏢 Institutions
interface InstitutionRelation {
    startDate?: string;
    relationType?: string;
    rnsr_key?: string;
    structure?: string;
    label?: string;
    natural_id?: string;
    denormalized?: DenormalizedInstitution;
}

export interface DenormalizedInstitution {
    id?: string;
    kind?: string[];
    label: Label;
    acronym?: Label;
    status?: string;
    isFrench?: boolean;
    categories?: string[];
    typologie_1?: string;
    typologie_2?: string;
    encoded_key?: string;
    mainAddress: MainAddress;
    institutions?: InstitutionRelation[];
}

interface ParentInstitution {
    startDate: string;
    endDate?: string;
    structure?: string;
    relationType?: string;
    natural_id?: string;
    denormalized: DenormalizedInstitution;
}

// 🔬 ROR Infos
interface RorInfos {
    id?: string;
    externalIds?: ExternalId[];
    startDate?: string;
    creationYear?: number;
    status?: string;
    label?: Label;
    kind?: string[];
    isFrench?: boolean;
    address?: RorAddress[];
    links?: Link[];
}

interface Source {
    id: string;
    level?: string;
    startDate?: string;
    creationYear?: number;
    status?: string;
    label: Label;
    acronym?: Label;
    kind?: string[];
    externalIds?: ExternalId[];
    isFrench?: boolean;
    address?: FullAddress[];
    institutions?: any[]; // À typer plus précisément si besoin
    categories?: string[];
    typologie_1?: string;
    typologie_2?: string;
    encoded_key?: string;
    links?: Link[];
    description?: Label;
    ror_infos?: RorInfos;
    main_category?: string;
    is_main_parent?: number;
    has_ai_description?: boolean;
    institutionOf?: InstitutionRelation[];
    mainAddress?: MainAddress;
    id_name?: string;
    id_name_default?: string;
    parents?: ParentInstitution[];
    parentOf?: ParentInstitution[];
}

export interface AgretatedScanROrganization extends Source {}

interface Hit {
    _index: string;
    _id: string;
    _score: number;
    _ignored?: string[];
    _source: Source;
}

export interface ScanrSearchResponse {
    took: number;
    timed_out: boolean;
    _shards: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
    hits: {
        total: {
            value: number;
            relation: string;
        };
        max_score: number | null;
        hits: Hit[];
    };
}
