BRANCH=$(git rev-parse --abbrev-ref HEAD)
CHANGED=$(git diff-index --name-only HEAD --)
if [ ! -z "${CHANGED}" ]; then
  echo "Commit your chages before bumping!";
  return;
fi;

if [ "${$BRANCH,0,4}" == "feat" ]
then
    yarn version --minor;
else
    yarn version --patch;
fi

git add .;
git commit -m "Version bump";