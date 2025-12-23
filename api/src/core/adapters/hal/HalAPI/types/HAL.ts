// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

export namespace HAL {
    // HAL implementation of https://schema.org/Organization
    export type Organization = {
        "@type": "Organization";
        identifier?: string;
        name: string;
        url?: string;
        parentOrganizations?: Organization[];
    };

    // HAL implementation of https://schema.org/Person
    export type Person = {
        "@id"?: string[];
        "@type": "Person";
        givenName?: string;
        familyName?: string;
        affiliation?: HAL.Organization[];
    };

    export type ArticleIdentifierOrigin = "doi" | "hal";

    // HAL implementation of https://codemeta.github.io/terms/
    export type SoftwareApplication = {
        "@context"?: string[];
        "@type": "SoftwareSourceCode";
        name: string;
        description?: string;
        dateCreated?: string;
        datePublished?: string;
        license?: string[] | string;
        url?: string;
        identifier?: Identifier[];
        applicationCategory?: string[];
        funder?: string[];
        keywords?: string[];
        codeRepository?: string[];
        programmingLanguage?: string[];
        operatingSystem?: string[];
        runtimePlatform?: string[];
        version?: string[] | string;
        softwareVersion?: string;
        dateModified?: string;
        developmentStatus?: string;
        author: Role[]; // Non regular Schema.org / CodeMeta
        contributor?: Person[];
        referencePublication?: string[] | string | Object;
    };

    // HAL implementation of https://codemeta.github.io/terms/
    export interface Role {
        "@type": "role";
        roleName: string; // aut
        author: Person; // Non regular Schema.org / CodeMeta
    }

    // HAL implementation of https://schema.org/identifier
    export type Identifier = {
        "@type": string;
        propertyID: string;
        value: string;
    };

    export namespace API {
        export class FetchError extends Error {
            constructor(public readonly status: number | undefined) {
                super(`Hal fetch error status: ${status}`);
                Object.setPrototypeOf(this, new.target.prototype);
            }
        }

        type Document = {
            // the following fields are the ones that we use
            docid: string;
            title_s: string[];
            en_title_s?: string[];
            fr_title_s?: string[];
            abstract_s?: string[];
            en_abstract_s?: string[];
            fr_abstract_s?: string[];
            uri_s: string;
            openAccess_bool: boolean;
            docType_s: string;
            label_bibtex: string;
            domainAllCode_s: string[];
            keyword_s: string[];
            authIdForm_i: number[];
            authFullName_s: string[];
            authIdHal_s: string[];
            releasedDate_tdate: string;
            softCodeRepository_s: string[];
            softPlatform_s?: string[];
            softProgrammingLanguage_s: string[];
            softVersion_s: string[];
            licence_s: string[];
            label_xml: string;
            relatedData_s?: string[];
            relatedPublication_s?: string[];
            relatedSoftware_s?: string[];

            // The following is the complete list of fields that could be returned by the HAL API

            // label_s: string;
            // citationRef_s: string;
            // citationFull_s: string;
            // label_endnote: string;
            // label_coins: string;
            // level0_domain_s: string[];
            // domain_s: string[];
            // level1_domain_s: string[];
            // fr_domainAllCodeLabel_fs?: string[];
            // en_domainAllCodeLabel_fs?: string[];
            // es_domainAllCodeLabel_fs: string[];
            // eu_domainAllCodeLabel_fs: string[];
            // primaryDomain_s: string;
            // en_keyword_s?: string[];
            // fr_keyword_s?: string[];
            // authIdFormPerson_s: string[];
            // authLastName_s: string[];
            // authFirstName_s: string[];
            // authMiddleName_s: string[];
            // authLastNameFirstName_s: string[];
            // authIdLastNameFirstName_fs: string[];
            // authFullNameIdFormPerson_fs: string[];
            // authAlphaLastNameFirstNameId_fs: string[];
            // authIdFullName_fs: string[];
            // authFullNameId_fs: string[];
            // authQuality_s: string[];
            // authFullNameFormIDPersonIDIDHal_fs: string[];
            // authFullNamePersonIDIDHal_fs: string[];
            // authIdHalFullName_fs: string[];
            // authFullNameIdHal_fs: string[];
            // authAlphaLastNameFirstNameIdHal_fs: string[];
            // authLastNameFirstNameIdHalPersonid_fs: string[];
            // authIdHasPrimaryStructure_fs: string[];
            // structPrimaryHasAuthId_fs: string[];
            // structPrimaryHasAuthIdHal_fs: string[];
            // structPrimaryHasAlphaAuthId_fs: string[];
            // structPrimaryHasAlphaAuthIdHal_fs: string[];
            // structPrimaryHasAlphaAuthIdHalPersonid_fs: string[];
            // authIdHasStructure_fs: string[];
            // structHasAuthId_fs: string[];
            // structHasAuthIdHal_fs: string[];
            // structHasAuthIdHalPersonid_s: string[];
            // structHasAlphaAuthId_fs: string[];
            // structHasAlphaAuthIdHal_fs: string[];
            // structHasAlphaAuthIdHalPersonid_fs: string[];
            // instStructId_i: number[];
            // instStructIdName_fs: string[];
            // instStructNameId_fs: string[];
            // instStructName_fs: string[];
            // instStructName_s: string[];
            // instStructAddress_s: string;
            // instStructCountry_s: string;
            // instStructType_s: string;
            // instStructValid_s: string;
            // structId_i: number[];
            // structIdName_fs: string[];
            // structNameId_fs: string[];
            // structName_fs: string[];
            // structName_s: string;
            // structAddress_s: string;
            // structCountry_s: string;
            // structType_s: string;
            // structValid_s: string;
            // contributorId_i: number;
            // contributorFullName_s: string;
            // contributorIdFullName_fs: string;
            // contributorFullNameId_fs: string;
            // language_s: string[];
            // halId_s: string;
            // version_i: number;
            // status_i: number;
            // instance_s: string;
            // sid_i: number;
            // submitType_s: string;
            // docSubType_s: string;
            // oldDocType_s: string;
            // thumbId_i: number;
            // selfArchiving_bool: boolean;
            // authorityInstitution_s: string[];
            // reportType_s: string;
            // inPress_bool: boolean;
            // modifiedDate_tdate: string;
            // modifiedDate_s: string;
            // modifiedDateY_i: number;
            // modifiedDateM_i: number;
            // modifiedDateD_i: number;
            // submittedDate_tdate: string;
            // submittedDate_s: string;
            // submittedDateY_i: number;
            // submittedDateM_i: number;
            // submittedDateD_i: number;
            // releasedDate_s: string;
            // releasedDateY_i: number;
            // releasedDateM_i: number;
            // releasedDateD_i: number;
            // producedDate_tdate: string;
            // producedDate_s: string;
            // producedDateY_i: number;
            // producedDateM_i: number;
            // producedDateD_i: number;
            // publicationDate_tdate: string;
            // publicationDate_s: string;
            // publicationDateY_i: number;
            // publicationDateM_i: number;
            // publicationDateD_i: number;
            // owners_i: number[];
            // collId_i: number[];
            // collName_s: string[];
            // collCode_s: string[];
            // collCategory_s: string[];
            // collIdName_fs: string[];
            // collNameId_fs: string[];
            // collCodeName_fs: string[];
            // collCategoryCodeName_fs: string[];
            // collNameCode_fs: string[];
            // fileMain_s: string;
            // files_s: string[];
            // fileType_s: string[];
            // _version_: bigint;
            // dateLastIndexed_tdate: string;
            // softDevelopmentStatus_s: string[];
            // softRuntimePlatform_s: string[];
        };

        export type Software = Document;

        export type Article = Pick<Document, "title_s" | "en_title_s" | "docid" | "fr_title_s">;

        export type Domain = {
            docid: number;
            haveNext_bool: boolean;
            code_s: string;
            en_domain_s: string;
            fr_domain_s: string;
            label_s: string;
            _version_: number;
            dateLastIndexed_tdate: string; // ISO date
            level_i: number;
        };

        export type Structure = {
            acronym_s: string[];
            acronym_sci: string[];
            acronym_t: string[];
            address_s: string[];
            address_t: string[];
            aliasDocid_i: number;
            code_s: string;
            code_sci: string;
            code_t: string;
            country_s: string;
            dateLastIndexed_tdate: Date;
            docid: string;
            label_html: string;
            label_s: string;
            label_sci: string;
            label_xml: string;
            locked_bool: boolean;
            name_s: string;
            name_sci: string;
            name_t: string;
            parentAcronym_s: string;
            parentAcronym_t: string;
            parentCountry_s: string;
            parentDocid_i: string[];
            parentName_s: string[];
            parentType_s: string[];
            parentUpdateDate_s: string[];
            parentUpdateDate_tdate: string[];
            parentUrl_s: string;
            parentValid_s: string;
            ror_s: string | string[];
            rorUrl_s: string;
            text: string;
            exte_autocomplete: string;
            type_s: string;
            updateDate_tdate: string;
            url_s: string;
            valid_s: string;
        };

        export type Author = {
            accountAssociated_bool: boolean;
            affPref_i: number;
            dateLastIndexed_tdate: string; // ISO Date String
            docid: string;
            emailDomain_s: string;
            emailId_t: string;
            firstName_s: string;
            firstName_t: string;
            form_i: number;
            fullNameDocid_fs: string;
            fullName_autocomplete: string;
            fullName_s: string;
            fullName_sci: string;
            fullName_t: string;
            hasCV_bool: boolean;
            idHal_i: number;
            idHal_s: string;
            label_html: string;
            label_s: string;
            lastName_s: string;
            lastName_t: string;
            middleName_s: string;
            middleName_t: string;
            person_i: number;
            text_autocomplete: string;
            valid_s: string;
        };
    }
}
