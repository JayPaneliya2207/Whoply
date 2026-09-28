/**
 * Company details the Privacy Policy and Terms depend on. Fill every field
 * before launch — until then both pages show a "Draft" banner listing what's
 * missing, so an incomplete legal page is never mistaken for a final one.
 *
 * The grievance officer is required by the IT (Intermediary Guidelines) Rules
 * and the DPDP Act 2023: a named person with an email, who answers within the
 * stated time.
 */
export const LEGAL = {
    /** Registered legal entity that operates Whoply, e.g. "Whoply Technologies Pvt. Ltd." */
    entityName: '',
    /** Registered office address. */
    address: '',
    /** Support / privacy contact email. */
    email: '',
    grievanceOfficer: { name: '', email: '' },
    /** City whose courts have jurisdiction, e.g. "Ahmedabad". */
    jurisdictionCity: '',
    /** Where customer data is stored, e.g. "servers in India (AWS Mumbai region)". */
    dataLocation: '',
    /** Date these versions take effect (shown on both pages). */
    effectiveDate: '',
};

/** Human names of the fields still empty — drives the Draft banner. */
export function missingLegalFields(): string[] {
    const missing: string[] = [];
    if (!LEGAL.entityName) missing.push('company name');
    if (!LEGAL.address) missing.push('registered address');
    if (!LEGAL.email) missing.push('contact email');
    if (!LEGAL.grievanceOfficer.name || !LEGAL.grievanceOfficer.email) missing.push('grievance officer name and email');
    if (!LEGAL.jurisdictionCity) missing.push('jurisdiction city');
    if (!LEGAL.dataLocation) missing.push('where data is stored');
    if (!LEGAL.effectiveDate) missing.push('effective date');
    return missing;
}

/** A value, or a visible "[to be added]" marker while it's still empty. */
export const orPending = (v: string) => v || '[to be added]';
