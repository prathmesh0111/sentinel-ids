#!/bin/bash
# Fetch real product images via z-ai image-search, 8-way parallel
OUT=/home/z/my-project/ml/img
mkdir -p "$OUT"
declare -A Q=(
  [samsung-s24]="Samsung Galaxy S24 5G smartphone official product photo"
  [iphone15]="Apple iPhone 15 smartphone official product photo"
  [redmi-note13]="Redmi Note 13 Pro smartphone official product photo"
  [boat-airdopes]="boAt Airdopes 161 TWS wireless earbuds product photo"
  [sony-headphones]="Sony WH-CH720N wireless over ear headphones product photo"
  [jbl-flip6]="JBL Flip 6 portable bluetooth speaker product photo"
  [hp-pavilion]="HP Pavilion 14 laptop product photo"
  [lenovo-ideapad]="Lenovo IdeaPad Slim 3 laptop product photo"
  [macbook-air]="Apple MacBook Air M2 laptop product photo"
  [apple-watch-se]="Apple Watch SE smartwatch product photo"
  [noise-watch]="Noise ColorFit Pro 5 smartwatch product photo"
  [galaxy-tab]="Samsung Galaxy Tab A9 Plus tablet product photo"
  [nike-shoes]="Nike Revolution 7 running shoes product photo"
  [adidas-shoes]="Adidas Ultraboost Light running shoes product photo"
  [levis-jeans]="Levis 511 slim fit blue jeans product photo"
  [uspolo-tshirt]="US Polo Assn mens polo t-shirt product photo"
  [rayban]="Ray-Ban Aviator classic sunglasses product photo"
  [prestige-mixer]="Prestige Iris 750W mixer grinder kitchen appliance product photo"
  [philips-airfryer]="Philips HD9200 air fryer kitchen appliance product photo"
  [milton-flask]="Milton Thermosteel stainless steel flask 1 litre product photo"
  [loreal-serum]="LOreal Paris Revitalift face serum bottle product photo"
  [philips-trimmer]="Philips BT1234 beard trimmer product photo"
  [nescafe]="Nescafe Classic instant coffee jar product photo"
  [pigeon-cookware]="Pigeon non-stick cookware set kitchen product photo"
)
run_one() {
  local key="$1"; local query="$2"
  z-ai image-search -q "$query" --count 2 --no-rank --gl us -o "$OUT/$key.json" >/dev/null 2>&1
  echo "done: $key"
}
jobs_running=0
for key in "${!Q[@]}"; do
  run_one "$key" "${Q[$key]}" &
  jobs_running=$((jobs_running+1))
  if (( jobs_running % 8 == 0 )); then wait; fi
done
wait
echo "ALL SEARCHES COMPLETE"
