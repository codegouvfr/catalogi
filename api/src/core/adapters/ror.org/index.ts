import { GetAuthorOrganization } from "../../ports/GetAuthorOrganization";
import { OtherSource } from "../../ports/SourceGateway";
import { fetchRorOrganizationById } from "./API/getOrganization";

type RorSource = OtherSource & {
    organization: {
        get: GetAuthorOrganization;
    };
};

export const rorOrgApi: RorSource = {
    organization: {
        get: fetchRorOrganizationById
    }
};
