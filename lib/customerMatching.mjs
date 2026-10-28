export const belongsToCustomer = (record, customer, customers, nameField) => {
  if (record.customerId) return record.customerId === customer.id;
  // Never attribute an unlinked legacy record to two customers with the same name.
  return record[nameField] === customer.fullName
    && customers.filter(candidate => candidate.fullName === customer.fullName).length === 1;
};
