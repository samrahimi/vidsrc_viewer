echo "Pushing updated settings.json to all users via vlix.ai endpoint"
cp ../browser/settings.json ../vlix_website/config
cd ../vlix_website && netlify deploy --prod .
echo "Done. Hope you know what you are doing "
