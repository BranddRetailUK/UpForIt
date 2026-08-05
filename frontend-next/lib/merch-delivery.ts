export const STANDARD_MERCH_DELIVERY_MINOR = 399;
export const SINGLE_PHONE_CASE_DELIVERY_MINOR = 299;

type MerchDeliveryLine = {
  productKind?: string;
  title: string;
  quantity: number;
};

function isPhoneCase(line: MerchDeliveryLine) {
  return /phone[\s_-]*case/i.test(`${line.productKind || ""} ${line.title}`);
}

export function getDisplayedMerchDeliveryMinor(lines: MerchDeliveryLine[]) {
  const onlyLine = lines.length === 1 ? lines[0] : undefined;
  return onlyLine && onlyLine.quantity === 1 && isPhoneCase(onlyLine)
    ? SINGLE_PHONE_CASE_DELIVERY_MINOR
    : STANDARD_MERCH_DELIVERY_MINOR;
}
