function(doc) {
  if (doc.type.indexOf("/type/project") >= 0) {
    emit(doc.creator.split('/')[2]+'/'+doc.name, doc);
  }
}
