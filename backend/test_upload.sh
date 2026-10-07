curl -X POST http://localhost:3000/api/issues/report \
  -F "title=Test Persistence" \
  -F "originalDescription=Testing if image uploads successfully." \
  -F "latitude=17.4" \
  -F "longitude=78.4" \
  -F "address=Hyderabad" \
  -F "reporter_id=38bd97b8-23b3-4804-9dd2-ad5c80de6806" \
  -F "image=@/Users/sreejareddy/Desktop/klh/frontend/public/vite.svg;type=image/svg+xml"
