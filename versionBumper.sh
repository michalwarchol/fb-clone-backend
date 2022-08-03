BRANCH=$(git rev-parse --abbrev-ref HEAD)
CHANGED=$(git diff-index --name-only HEAD --)
SUBSTRING=$(echo $BRANCH | cut -b 1-4)

if [ ! -z "${CHANGED}" ]; then
  echo "Commit your chages before bumping!";
  return;
fi;

if [ "${SUBSTRING}" = "feat" ]
then
  echo $(echo $BRANCH | cut -b 1-4)
    yarn version --minor;
else
    yarn version --patch;
fi

git add .;
git commit -m "Version bump";