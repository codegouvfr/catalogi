// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export namespace Zenodo {
    export type Creator = {
        name: string;
        affiliation: string | null;
        orcid?: string;
    };

    type RelatedIdentifier = {
        identifier: string;
        relation: string;
        resource_type: string;
        scheme: string;
    };

    type License = {
        id: string;
    };

    type CommunityId = {
        id: string;
    };

    type VersionRelation = {
        index: number;
        is_last: boolean;
        parent: {
            pid_type: string;
            pid_value: string;
        };
    };

    type Relations = {
        version: VersionRelation[];
    };

    type Custom = {
        id: string;
        title: {
            en: string;
        };
    };

    type Metadata = {
        title: string;
        doi: string;
        publication_date: Date;
        description?: string;
        access_right: string;
        creators: Creator[];
        related_identifiers?: RelatedIdentifier[];
        version: string;
        custom: {
            "code:codeRepository"?: string;
            "code:programmingLanguage"?: Custom[];
            "code:developmentStatus": {
                id: string;
                title: {
                    en: string;
                };
            };
        };
        resource_type: {
            title: string;
            type: string;
        };
        license?: License;
        communities?: CommunityId[];
        relations: Relations;
        notes: string;
        keywords?: string[];
    };

    type Links = {
        self: string;
        self_html: string;
        preview_html: string;
        doi: string;
        self_doi: string;
        self_doi_html: string;
        reserve_doi: string;
        parent: string;
        parent_html: string;
        parent_doi: string;
        parent_doi_html: string;
        self_iiif_manifest: string;
        self_iiif_sequence: string;
        files: string;
        media_files: string;
        archive: string;
        archive_media: string;
        latest: string;
        latest_html: string;
        versions: string;
        draft: string;
        access_links: string;
        access_grants: string;
        access_users: string;
        access_request: string;
        access: string;
        communities: string;
        "communities-suggestions": string;
        requests: string;
    };

    type File = {
        id: string;
        key: string;
        size: number;
        checksum: string;
        links: {
            self: string;
        };
    };

    type SWH = {
        swhid: string;
        origin: string;
        visit: string;
        anchor: string;
        path: string;
    };

    type Owner = {
        id: string;
    };

    type Stats = {
        downloads: number;
        unique_downloads: number;
        views: number;
        unique_views: number;
        version_downloads: number;
        version_unique_downloads: number;
        version_unique_views: number;
        version_views: number;
    };

    export type Record = {
        created: Date;
        modified: Date;
        id: number;
        conceptrecid: string;
        doi: string;
        conceptdoi: string;
        doi_url: string;
        metadata: Metadata;
        title: string;
        links: Links;
        updated: Date;
        recid: string;
        revision: number;
        files: File[];
        swh: SWH;
        owners: Owner[];
        status: string;
        stats: Stats;
        state: string;
        submitted: boolean;
    };

    type Identifier = {
        identifier: string;
        scheme: string;
    };

    type Funder = {
        id: string;
        name: string;
    };

    type Award = {
        number: string;
        title: {
            en: string;
        };
        identifiers: Identifier[];
    };

    type Funding = {
        funder: Funder;
        award: Award;
    };

    type Organization = {
        id: string;
        name: string;
        identifiers: Identifier[];
    };

    type Type = {
        id: string;
        title: {
            de: string;
            en: string;
        };
    };

    type CommunityMetadata = {
        title: string;
        type: Type;
        website: string;
        funding: Funding[];
        organizations: Organization[];
    };

    type CommunityLinks = {
        self: string;
        self_html: string;
        settings_html: string;
        logo: string;
        rename: string;
        members: string;
        public_members: string;
        invitations: string;
        requests: string;
        records: string;
        membership_requests: string;
    };

    type Access = {
        visibility: string;
        members_visibility: string;
        member_policy: string;
        record_submission_policy: string;
        review_policy: string;
    };

    type DeletionStatus = {
        is_deleted: boolean;
        status: string;
    };

    type Children = {
        allow: boolean;
    };

    export type Community = {
        id: string;
        created: string;
        updated: string;
        links: CommunityLinks;
        revision_id: number;
        slug: string;
        metadata: CommunityMetadata;
        access: Access;
        custom_fields: {};
        deletion_status: DeletionStatus;
        children: Children;
    };

    type Hits<T> = {
        hits: T[];
        total: number;
    };

    type Bucket = {
        key: string;
        doc_count: number;
        label: string;
        is_selected: boolean;
    };

    type Aggregations = {
        type: {
            buckets: Bucket[];
            label: string;
        };
        funder: {
            buckets: Bucket[];
            label: string;
        };
        organization: {
            buckets: Bucket[];
            label: string;
        };
    };

    export type Response<T> = {
        hits: Hits<T>;
        aggregations: Aggregations;
        sortBy: string;
        links: {
            self: string;
        };
    };
}
